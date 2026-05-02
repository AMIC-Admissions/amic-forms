let values = {};
let fields = [];
let pageDimensions = [];
let originalPdfBytes = null;
let originalPdfName = "filled-document.pdf";
const signaturePads = new Map();

const FIELD_DEFAULTS = {
  text: { x: 10, y: 10, width: 30, height: 6 },
  date: { x: 10, y: 18, width: 22, height: 6 },
  checkbox: { x: 10, y: 26, width: 6, height: 4 },
  signature: { x: 10, y: 34, width: 36, height: 12 },
};

const FIELD_COLUMNS = [
  "amic_fieldid",
  "amic_key",
  "amic_type",
  "amic_x",
  "amic_y",
  "amic_width",
  "amic_height",
  "amic_pagenumber",
  "amic_metadata",
  "amic_value",
  "amic_signatureimage",
  "amic_signedat",
  "amic_signername",
];

const SIGNATURE_MAX_WIDTH = 600;
const SIGNATURE_MAX_HEIGHT = 300;
const SIGNATURE_MAX_BYTES = 250 * 1024;
const SIGNATURE_JPEG_QUALITY = 0.82;

document.addEventListener("DOMContentLoaded", () => {
  const documentId = getDocumentId();

  bindPdfControls();
  document.addEventListener("amic:pdf-rendered", (event) => {
    updatePageDimensions((event.detail && event.detail.pages) || []);
  });

  const initialPdfUrl = getInitialPdfUrl();
  if (initialPdfUrl) {
    renderPDFUrl(initialPdfUrl).catch((error) => setFormError(error.message));
  }

  if (!documentId) {
    setFormError("Document id is required before fields can be loaded.");
    return;
  }

  loadFields(documentId).catch((error) => setFormError(error.message));
});

function update(key, value) {
  values[key] = value;
  document.querySelectorAll(`[data-key="${key}"]`).forEach((element) => {
    if (element.value !== undefined) {
      element.value = value;
    }
  });
}

function bindPdfControls() {
  const fileInput = document.getElementById("pdf-file");

  if (!fileInput) {
    return;
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];

    if (!file) {
      return;
    }

    renderPDFFile(file).catch((error) => setFormError(error.message));
  });
}

async function renderPDFFile(file) {
  if (!window.AmicPDF) {
    throw new Error("PDF renderer is not available.");
  }

  setDownloadEnabled(false);
  const data = await file.arrayBuffer();
  setOriginalPdfBytes(data, file.name || originalPdfName);

  const result = await AmicPDF.loadPDF(copyPdfBytes(data), {
    container: "#pdf-container",
    sourceName: file.name || "",
  });
  updatePageDimensions(result.pages);
}

async function renderPDFUrl(url) {
  if (!window.AmicPDF) {
    throw new Error("PDF renderer is not available.");
  }

  setDownloadEnabled(false);
  const data = await fetchPdfBytes(url);
  setOriginalPdfBytes(data, url);

  const result = await AmicPDF.loadPDF(copyPdfBytes(data), {
    container: "#pdf-container",
    sourceName: url,
  });
  updatePageDimensions(result.pages);
}

async function fetchPdfBytes(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to load original PDF: ${await response.text()}`);
  }

  return response.arrayBuffer();
}

function copyPdfBytes(data) {
  if (data instanceof ArrayBuffer) {
    return data.slice(0);
  }

  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }

  return data;
}

function setOriginalPdfBytes(data, sourceName) {
  originalPdfBytes = copyPdfBytes(data);
  originalPdfName = makeFilledPdfName(sourceName || originalPdfName);
  setDownloadEnabled(Boolean(originalPdfBytes));
}

function setDownloadEnabled(enabled) {
  const button = document.getElementById("download-pdf");

  if (button) {
    button.disabled = !enabled;
  }
}

function makeFilledPdfName(sourceName) {
  let nameSource = String(sourceName || "document.pdf");

  try {
    nameSource = new URL(nameSource, location.href).pathname;
  } catch (_error) {
    nameSource = nameSource.split("?")[0].split("#")[0];
  }

  const cleanName = nameSource.replaceAll(String.fromCharCode(92), "/").split("/").pop() || "document.pdf";
  const pdfName = cleanName.toLowerCase().endsWith(".pdf") ? cleanName : `${cleanName}.pdf`;

  return `${pdfName.slice(0, -4)}-filled.pdf`;
}

function updatePageDimensions(pages) {
  pageDimensions = Array.isArray(pages) ? pages : [];
  window.amicPageDimensions = pageDimensions;
  renderFields();
}

function getInitialPdfUrl() {
  const params = new URLSearchParams(location.search);

  return params.get("pdf") || params.get("pdfUrl") || params.get("url") || "";
}

function getDocumentId() {
  return sanitizeId(new URLSearchParams(location.search).get("id"));
}

function sanitizeId(id) {
  return (id || "").replace(/[{}]/g, "");
}

function normalizeType(type) {
  const normalized = String(type || "text").toLowerCase();

  return FIELD_DEFAULTS[normalized] ? normalized : "text";
}

function createMetadata(type, metadata) {
  return Object.assign(
    {
      label: type,
      required: type === "signature",
      unit: "percent",
    },
    metadata || {}
  );
}

function parseMetadata(value, type) {
  if (!value) {
    return createMetadata(type);
  }

  if (typeof value === "object") {
    return createMetadata(type, value);
  }

  try {
    return createMetadata(type, JSON.parse(value));
  } catch (_error) {
    return createMetadata(type, { raw: value });
  }
}

function toNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeBox(box, defaults) {
  const width = clamp(toNumber(box.width, defaults.width), 1, 100);
  const height = clamp(toNumber(box.height, defaults.height), 1, 100);

  return {
    x: clamp(toNumber(box.x, defaults.x), 0, 100 - width),
    y: clamp(toNumber(box.y, defaults.y), 0, 100 - height),
    width,
    height,
  };
}

function getSignatureImage(row, metadata) {
  return (
    row.amic_signatureimage ||
    row.amic_value ||
    metadata.signatureImage ||
    (metadata.signature && metadata.signature.image) ||
    (metadata.signature && metadata.signature.dataUrl) ||
    ""
  );
}

function getFieldValue(row, metadata, type) {
  if (type === "signature") {
    return getSignatureImage(row, metadata);
  }

  const storedValue =
    row.amic_value !== undefined && row.amic_value !== null
      ? row.amic_value
      : metadata.value !== undefined
        ? metadata.value
        : "";

  if (type === "checkbox") {
    return toBoolean(storedValue);
  }

  if (type === "date") {
    return normalizeDateValue(storedValue);
  }

  return storedValue == null ? "" : String(storedValue);
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return ["true", "1", "yes", "on"].includes(String(value || "").toLowerCase());
}

function isIsoDateValue(value) {
  const parts = String(value || "").split("-");

  return (
    parts.length === 3 &&
    parts[0].length === 4 &&
    parts[1].length === 2 &&
    parts[2].length === 2 &&
    parts.every((part) => Array.from(part).every((character) => character >= "0" && character <= "9"))
  );
}

function normalizeDateValue(value) {
  if (!value) {
    return "";
  }

  const stringValue = String(value);

  if (isIsoDateValue(stringValue)) {
    return stringValue;
  }

  const parsed = new Date(stringValue);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function getFieldsQuery(documentId) {
  const filter = `_amic_documentid_value eq ${sanitizeId(documentId)}`;

  return `/_api/amic_fields?$select=${FIELD_COLUMNS.join(",")}&$filter=${encodeURIComponent(filter)}`;
}

async function loadFields(documentId) {
  const response = await fetch(getFieldsQuery(documentId));

  if (!response.ok) {
    throw new Error(`Unable to load fields: ${await response.text()}`);
  }

  const data = await response.json();
  fields = (data.value || []).map(fieldFromBackend).sort(sortFields);
  window.amicSigningFields = fields;
  window.amicSignatureFields = fields.filter((field) => field.type === "signature");

  fields.forEach((field) => {
    values[field.key] = {
      fieldId: field.id,
      value: field.value,
    };
  });

  renderFields();
}

function fieldFromBackend(row) {
  const type = normalizeType(row.amic_type);
  const defaults = FIELD_DEFAULTS[type];
  const metadata = parseMetadata(row.amic_metadata, type);
  const page = Math.max(1, Math.round(toNumber(row.amic_pagenumber, 1)));
  const image = type === "signature" ? getSignatureImage(row, metadata) : "";
  const value = getFieldValue(row, metadata, type);

  return {
    id: row.amic_fieldid || "",
    key: row.amic_key || `${type}${Date.now()}`,
    type,
    page,
    metadata,
    image,
    value,
    locked: type === "signature" && Boolean(image),
    ...normalizeBox(
      {
        x: row.amic_x,
        y: row.amic_y,
        width: row.amic_width,
        height: row.amic_height,
      },
      defaults
    ),
  };
}

function sortFields(a, b) {
  return a.page - b.page || a.y - b.y || a.x - b.x || a.key.localeCompare(b.key);
}

function getFieldLayer(pageNumber) {
  return document.querySelector(`.pdf-page[data-page-number="${pageNumber}"] .field-layer`);
}

function applyFieldBox(element, field) {
  element.style.left = `${field.x}%`;
  element.style.top = `${field.y}%`;
  element.style.width = `${field.width}%`;
  element.style.height = `${field.height}%`;
}

function getFieldLabel(field) {
  return field.metadata.label || field.type;
}

function setFormError(message) {
  const errorEl = document.getElementById("form-error");

  if (!errorEl) {
    return;
  }

  errorEl.textContent = message || "";
  errorEl.hidden = !message;
}

function showPdfMessage(message) {
  const container = document.getElementById("pdf-container");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const messageEl = document.createElement("div");
  messageEl.className = "message";
  messageEl.textContent = message;
  container.appendChild(messageEl);
}

function renderFields() {
  document.querySelectorAll(".field-layer .sign-field").forEach((element) => element.remove());
  signaturePads.clear();

  if (fields.length === 0) {
    window.amicSigningFields = fields;
    window.amicSignatureFields = [];
    return;
  }

  const hasRenderedPages = Boolean(document.querySelector(".field-layer"));

  if (!hasRenderedPages) {
    showPdfMessage("Select a PDF to render fields.");
    return;
  }

  let renderedCount = 0;

  fields.forEach((field) => {
    const layer = getFieldLayer(field.page);

    if (!layer) {
      return;
    }

    renderField(field, layer);
    renderedCount += 1;
  });

  if (renderedCount === 0) {
    setFormError("Fields were loaded, but none matched the rendered PDF pages.");
  } else {
    setFormError("");
  }
}

function renderField(field, layer) {
  const element = document.createElement("div");
  const error = document.createElement("div");
  const signatureCanvas = renderFieldControl(field, element);

  element.className = `sign-field sign-field-${field.type}`;
  element.dataset.key = field.key;
  element.dataset.fieldId = field.id;
  element.dataset.pageNumber = String(field.page);
  element.title = getFieldLabel(field);
  applyFieldBox(element, field);

  error.className = "field-error";
  error.dataset.errorFor = field.key;
  error.hidden = true;
  element.appendChild(error);
  layer.appendChild(element);

  if (signatureCanvas) {
    initializeSignaturePad(field, signatureCanvas);
  }
}

function renderFieldControl(field, element) {
  if (field.type === "signature") {
    return renderSignatureControl(field, element);
  }

  if (field.type === "checkbox") {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "field-checkbox";
    checkbox.checked = Boolean(field.value);
    checkbox.dataset.key = field.key;
    checkbox.dataset.fieldId = field.id;
    checkbox.setAttribute("aria-label", getFieldLabel(field));
    checkbox.addEventListener("change", () => {
      setFieldValue(field, checkbox.checked);
    });
    element.appendChild(checkbox);
    return null;
  }

  const input = document.createElement("input");
  input.type = field.type === "date" ? "date" : "text";
  input.className = "field-control";
  input.value = field.value || "";
  input.dataset.key = field.key;
  input.dataset.fieldId = field.id;
  input.placeholder = field.metadata.placeholder || "";
  input.setAttribute("aria-label", getFieldLabel(field));
  input.addEventListener("input", () => {
    setFieldValue(field, input.value);
  });
  element.appendChild(input);
  return null;
}

function renderSignatureControl(field, element) {
  const preview = document.createElement("div");
  const signatureImg = document.createElement("img");
  const actions = document.createElement("div");
  const clearButton = document.createElement("button");
  const status = document.createElement("div");

  actions.className = "field-actions";

  if (field.locked && field.image) {
    preview.className = "signature-preview";
    signatureImg.className = "signature-img";
    signatureImg.alt = `${getFieldLabel(field)} image`;
    signatureImg.src = field.image;
    status.className = "signed-note";
    status.textContent = getSignedStatus(field);
    preview.appendChild(signatureImg);
    actions.appendChild(status);
    element.append(preview, actions);
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "signature-pad";
  canvas.dataset.key = field.key;
  canvas.dataset.fieldId = field.id;
  clearButton.type = "button";
  clearButton.textContent = "Clear";
  clearButton.addEventListener("click", () => {
    const pad = signaturePads.get(field.key);
    if (pad) {
      pad.clear();
    }
    setFieldValue(field, "");
  });
  actions.appendChild(clearButton);
  element.append(canvas, actions);

  return canvas;
}

function setFieldValue(field, value) {
  field.value = value;

  if (field.type === "signature") {
    field.image = value || "";
  }

  values[field.key] = {
    fieldId: field.id,
    value,
  };
  clearFieldError(field.key);
}

function getSignedStatus(field) {
  const signedAt = field.metadata.signature && field.metadata.signature.signedAt;

  return signedAt ? `Signed ${new Date(signedAt).toLocaleString()}` : "Signed";
}

function initializeSignaturePad(field, canvas) {
  resizeSignatureCanvas(canvas);

  const pad = new SignaturePad(canvas, {
    backgroundColor: "rgb(255, 255, 255)",
    penColor: "rgb(15, 23, 42)",
  });

  if (field.image && isDataImage(field.image)) {
    pad.fromDataURL(field.image);
  }

  pad.addEventListener("endStroke", () => {
    const image = pad.toDataURL("image/png");
    setFieldValue(field, image);
  });

  signaturePads.set(field.key, pad);
}

function resizeSignatureCanvas(canvas) {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  const parentRect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : {};
  const cssWidth = rect.width || parentRect.width || canvas.clientWidth || 300;
  const cssHeight = rect.height || parentRect.height || canvas.clientHeight || 120;
  const width = Math.max(1, Math.round(cssWidth * ratio));
  const height = Math.max(1, Math.round(cssHeight * ratio));
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  context.scale(ratio, ratio);
}

function getDataUrlSize(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";

  return Math.ceil((base64.length * 3) / 4);
}

function isDataImage(value) {
  return String(value || "").toLowerCase().startsWith("data:image/");
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function hasSignature(field) {
  const pad = signaturePads.get(field.key);

  return Boolean(field.image || (pad && !pad.isEmpty()));
}

function findFieldElement(key) {
  return Array.from(document.querySelectorAll(".sign-field")).find(
    (element) => element.dataset.key === key
  );
}

function findFieldErrorElement(key) {
  return Array.from(document.querySelectorAll("[data-error-for]")).find(
    (element) => element.dataset.errorFor === key
  );
}

function setFieldError(key, message) {
  const fieldEl = findFieldElement(key);
  const errorEl = findFieldErrorElement(key);

  if (fieldEl) {
    fieldEl.classList.toggle("invalid", Boolean(message));
  }

  if (errorEl) {
    errorEl.textContent = message || "";
    errorEl.hidden = !message;
  }
}

function clearFieldError(key) {
  setFieldError(key, "");
  setFormError("");
}

function syncFieldValuesFromDom() {
  fields.forEach((field) => {
    const fieldEl = findFieldElement(field.key);

    if (!fieldEl) {
      return;
    }

    if (field.type === "checkbox") {
      const checkbox = fieldEl.querySelector(".field-checkbox");
      if (checkbox) {
        field.value = checkbox.checked;
      }
      return;
    }

    if (field.type === "signature") {
      const pad = signaturePads.get(field.key);
      if (pad && !pad.isEmpty()) {
        const image = pad.toDataURL("image/png");
        field.value = image;
        field.image = image;
      }
      return;
    }

    const input = fieldEl.querySelector(".field-control");
    if (input) {
      field.value = input.value;
    }
  });
}

function isRequired(field) {
  const required = field.metadata && field.metadata.required;

  return required === true || required === 1 || String(required).toLowerCase() === "true";
}

function fieldHasValue(field) {
  if (field.type === "signature") {
    return hasSignature(field);
  }

  if (field.type === "checkbox") {
    return Boolean(field.value);
  }

  return String(field.value || "").trim().length > 0;
}

function validateFields() {
  syncFieldValuesFromDom();
  fields.forEach((field) => clearFieldError(field.key));

  const missingFields = fields.filter((field) => isRequired(field) && !fieldHasValue(field));

  if (missingFields.length === 0) {
    setFormError("");
    return true;
  }

  missingFields.forEach((field) => {
    setFieldError(field.key, `${getFieldLabel(field)} is required.`);
  });
  setFormError("Complete all required fields before submitting.");

  const firstMissing = findFieldElement(missingFields[0].key);

  if (firstMissing) {
    firstMissing.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return false;
}

async function resizeSignatureImage(dataUrl) {
  if (!isDataImage(dataUrl)) {
    return {
      image: dataUrl,
      mimeType: "image/*",
      width: 0,
      height: 0,
      bytes: String(dataUrl || "").length,
    };
  }

  const image = await loadImage(dataUrl);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(
    1,
    SIGNATURE_MAX_WIDTH / sourceWidth,
    SIGNATURE_MAX_HEIGHT / sourceHeight
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const png = canvas.toDataURL("image/png");
  const pngBytes = getDataUrlSize(png);

  if (pngBytes <= SIGNATURE_MAX_BYTES) {
    return {
      image: png,
      mimeType: "image/png",
      width,
      height,
      bytes: pngBytes,
    };
  }

  const jpeg = canvas.toDataURL("image/jpeg", SIGNATURE_JPEG_QUALITY);
  const jpegBytes = getDataUrlSize(jpeg);
  const shouldUseJpeg = jpegBytes < pngBytes;

  return {
    image: shouldUseJpeg ? jpeg : png,
    mimeType: shouldUseJpeg ? "image/jpeg" : "image/png",
    width,
    height,
    bytes: shouldUseJpeg ? jpegBytes : pngBytes,
  };
}

async function getSignedImage(field) {
  const pad = signaturePads.get(field.key);
  const image =
    pad && !pad.isEmpty() ? pad.toDataURL("image/png") : field.image || field.value || "";

  if (!image) {
    return null;
  }

  return resizeSignatureImage(image);
}

function buildSignatureMetadata(field, optimizedSignature, signedAt) {
  const metadata = Object.assign({}, field.metadata);
  delete metadata.signatureImage;

  metadata.value = optimizedSignature.image;
  metadata.updatedAt = signedAt;
  metadata.signature = {
    fieldId: field.id,
    fieldKey: field.key,
    image: optimizedSignature.image,
    mimeType: optimizedSignature.mimeType,
    width: optimizedSignature.width,
    height: optimizedSignature.height,
    bytes: optimizedSignature.bytes,
    maxWidth: SIGNATURE_MAX_WIDTH,
    maxHeight: SIGNATURE_MAX_HEIGHT,
    signedAt,
    signerName: values.parent || "",
  };

  return metadata;
}

function buildValueMetadata(field, value, updatedAt) {
  const metadata = Object.assign({}, field.metadata);

  metadata.value = value;
  metadata.updatedAt = updatedAt;
  metadata.fieldId = field.id;
  metadata.fieldKey = field.key;

  return metadata;
}

function serializeFieldValue(field) {
  if (field.type === "checkbox") {
    return field.value ? "true" : "false";
  }

  return field.value == null ? "" : String(field.value);
}

async function patchField(field, payload) {
  const response = await fetch(`/_api/amic_fields(${sanitizeId(field.id)})`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "If-Match": "*",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function saveWithFallbacks(field, payloads, label) {
  for (const payload of payloads) {
    try {
      await patchField(field, payload);
      return;
    } catch (error) {
      if (payload === payloads[payloads.length - 1]) {
        throw new Error(`Unable to save ${label}: ${error.message}`);
      }
    }
  }
}

async function saveSignatureField(field) {
  const signedAt = new Date().toISOString();
  const optimizedSignature = await getSignedImage(field);

  if (!optimizedSignature) {
    throw new Error(`${getFieldLabel(field)} is required.`);
  }

  const metadata = buildSignatureMetadata(field, optimizedSignature, signedAt);
  const payloads = [
    {
      amic_signatureimage: optimizedSignature.image,
      amic_value: optimizedSignature.image,
      amic_signedat: signedAt,
      amic_signername: values.parent || "",
      amic_metadata: JSON.stringify(metadata),
    },
    {
      amic_value: optimizedSignature.image,
      amic_metadata: JSON.stringify(metadata),
    },
    {
      amic_metadata: JSON.stringify(metadata),
    },
  ];

  await saveWithFallbacks(field, payloads, getFieldLabel(field));

  field.image = optimizedSignature.image;
  field.value = optimizedSignature.image;
  field.locked = true;
  field.metadata = metadata;
  values[field.key] = {
    fieldId: field.id,
    value: optimizedSignature.image,
    image: optimizedSignature.image,
    mimeType: optimizedSignature.mimeType,
    bytes: optimizedSignature.bytes,
    signedAt,
  };
}

async function saveValueField(field) {
  const updatedAt = new Date().toISOString();
  const value = serializeFieldValue(field);
  const metadata = buildValueMetadata(field, field.type === "checkbox" ? Boolean(field.value) : value, updatedAt);
  const payloads = [
    {
      amic_value: value,
      amic_metadata: JSON.stringify(metadata),
    },
    {
      amic_metadata: JSON.stringify(metadata),
    },
  ];

  await saveWithFallbacks(field, payloads, getFieldLabel(field));

  field.metadata = metadata;
  values[field.key] = {
    fieldId: field.id,
    value: field.type === "checkbox" ? Boolean(field.value) : value,
  };
}

async function saveFieldValue(field) {
  if (!field.id) {
    throw new Error(`${getFieldLabel(field)} is missing a backend field id.`);
  }

  if (field.type === "signature") {
    await saveSignatureField(field);
    return;
  }

  await saveValueField(field);
}

function getPdfWriterLibrary() {
  if (!window.PDFLib) {
    throw new Error("PDF generator is not available. Include pdf-lib before sign.js.");
  }

  return window.PDFLib;
}

function getPageElement(pageNumber) {
  return document.querySelector(`.pdf-page[data-page-number="${pageNumber}"]`);
}

function getPdfPageSize(pdfPage) {
  return pdfPage.getSize ? pdfPage.getSize() : { width: pdfPage.getWidth(), height: pdfPage.getHeight() };
}

function getPercentPdfBox(pdfPage, field) {
  const pageSize = getPdfPageSize(pdfPage);
  const width = (field.width / 100) * pageSize.width;
  const height = (field.height / 100) * pageSize.height;
  const x = (field.x / 100) * pageSize.width;
  const top = (field.y / 100) * pageSize.height;

  return {
    x,
    y: pageSize.height - top - height,
    width,
    height,
  };
}

function getPdfBoxFromElement(pdfPage, field, element) {
  const pageEl = getPageElement(field.page);

  if (!pageEl || !element || !pageEl.getBoundingClientRect || !element.getBoundingClientRect) {
    return null;
  }

  const pageRect = pageEl.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  if (!pageRect.width || !pageRect.height || !elementRect.width || !elementRect.height) {
    return null;
  }

  const pageSize = getPdfPageSize(pdfPage);
  const x = ((elementRect.left - pageRect.left) / pageRect.width) * pageSize.width;
  const top = ((elementRect.top - pageRect.top) / pageRect.height) * pageSize.height;
  const width = (elementRect.width / pageRect.width) * pageSize.width;
  const height = (elementRect.height / pageRect.height) * pageSize.height;

  return {
    x,
    y: pageSize.height - top - height,
    width,
    height,
  };
}

function getFieldPdfBox(pdfPage, field, element) {
  return getPdfBoxFromElement(pdfPage, field, element) || getPercentPdfBox(pdfPage, field);
}

function getPdfScaleForElement(pdfPage, field) {
  const pageEl = getPageElement(field.page);

  if (!pageEl || !pageEl.getBoundingClientRect) {
    return { x: 1, y: 1 };
  }

  const pageRect = pageEl.getBoundingClientRect();

  if (!pageRect.width || !pageRect.height) {
    return { x: 1, y: 1 };
  }

  const pageSize = getPdfPageSize(pdfPage);

  return {
    x: pageSize.width / pageRect.width,
    y: pageSize.height / pageRect.height,
  };
}

function getFieldControlElement(field) {
  const fieldEl = findFieldElement(field.key);

  if (!fieldEl) {
    return null;
  }

  if (field.type === "checkbox") {
    return fieldEl.querySelector(".field-checkbox") || fieldEl;
  }

  if (field.type === "signature") {
    return fieldEl.querySelector(".signature-preview") || fieldEl.querySelector(".signature-pad") || fieldEl;
  }

  return fieldEl.querySelector(".field-control") || fieldEl;
}

function getCssFontSize(element) {
  if (!element || !window.getComputedStyle) {
    return 14;
  }

  const fontSize = parseFloat(window.getComputedStyle(element).fontSize);

  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 14;
}

function toPdfSafeText(value) {
  return Array.from(String(value || ""))
    .map((character) => {
      const code = character.charCodeAt(0);
      const isSupported =
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code <= 126) ||
        (code >= 160 && code <= 255);

      return isSupported ? character : "?";
    })
    .join("");
}

function fitSingleLineText(text, font, size, maxWidth) {
  const ellipsis = "...";
  let fontSize = Math.max(5, size);
  let safeText = toPdfSafeText(text);

  while (fontSize > 5 && font.widthOfTextAtSize(safeText, fontSize) > maxWidth) {
    fontSize -= 0.5;
  }

  if (font.widthOfTextAtSize(safeText, fontSize) <= maxWidth) {
    return { text: safeText, fontSize };
  }

  while (safeText.length > 0 && font.widthOfTextAtSize(`${safeText}${ellipsis}`, fontSize) > maxWidth) {
    safeText = safeText.slice(0, -1);
  }

  return {
    text: safeText ? `${safeText}${ellipsis}` : "",
    fontSize,
  };
}

function formatDateForPdf(value) {
  if (!value) {
    return "";
  }

  const stringValue = String(value);

  if (isIsoDateValue(stringValue)) {
    const parts = stringValue.split("-");

    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }

  const parsed = new Date(stringValue);

  if (Number.isNaN(parsed.getTime())) {
    return stringValue;
  }

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${month}/${day}/${parsed.getFullYear()}`;
}

function getPrintableFieldValue(field) {
  if (field.type === "date") {
    return formatDateForPdf(field.value);
  }

  return field.value == null ? "" : String(field.value);
}

function drawTextField(pdfPage, field, font, color) {
  const value = getPrintableFieldValue(field);

  if (!value) {
    return;
  }

  const control = getFieldControlElement(field);
  const box = getFieldPdfBox(pdfPage, field, control);
  const scale = getPdfScaleForElement(pdfPage, field);
  const paddingX = 3 * scale.x;
  const maxWidth = Math.max(1, box.width - paddingX * 2);
  const visualFontSize = getCssFontSize(control) * scale.y;
  const targetFontSize = Math.max(5, Math.min(visualFontSize, box.height * 0.78));
  const fitted = fitSingleLineText(value, font, targetFontSize, maxWidth);

  if (!fitted.text) {
    return;
  }

  pdfPage.drawText(fitted.text, {
    x: box.x + paddingX,
    y: box.y + Math.max(0, (box.height - fitted.fontSize) / 2) + fitted.fontSize * 0.18,
    size: fitted.fontSize,
    font,
    color,
  });
}

function drawCheckboxField(pdfPage, field, color) {
  if (!field.value) {
    return;
  }

  const control = getFieldControlElement(field);
  const box = getFieldPdfBox(pdfPage, field, control);
  const size = Math.min(box.width, box.height);
  const x = box.x + (box.width - size) / 2;
  const y = box.y + (box.height - size) / 2;
  const thickness = Math.max(1, size * 0.12);

  pdfPage.drawLine({
    start: { x: x + size * 0.18, y: y + size * 0.5 },
    end: { x: x + size * 0.4, y: y + size * 0.24 },
    thickness,
    color,
  });
  pdfPage.drawLine({
    start: { x: x + size * 0.4, y: y + size * 0.24 },
    end: { x: x + size * 0.84, y: y + size * 0.78 },
    thickness,
    color,
  });
}

function dataUrlToBytes(dataUrl) {
  const parts = String(dataUrl).split(",");
  const header = parts[0] || "";
  const base64 = parts[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return {
    bytes,
    mimeType: header.startsWith("data:") ? header.slice(5).split(";")[0] : "image/png",
  };
}

async function bytesFromImageSource(source) {
  if (isDataImage(source)) {
    return dataUrlToBytes(source);
  }

  const response = await fetch(source);

  if (!response.ok) {
    throw new Error(`Unable to load signature image: ${await response.text()}`);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: response.headers.get("Content-Type") || source,
  };
}

async function embedImage(pdfDoc, source) {
  const imageData = await bytesFromImageSource(source);
  const mimeType = imageData.mimeType.toLowerCase();

  if (mimeType.includes("jpg") || mimeType.includes("jpeg")) {
    return pdfDoc.embedJpg(imageData.bytes);
  }

  return pdfDoc.embedPng(imageData.bytes);
}

function getSignatureSource(field) {
  const pad = signaturePads.get(field.key);

  if (pad && !pad.isEmpty()) {
    return pad.toDataURL("image/png");
  }

  return (
    field.image ||
    field.value ||
    field.metadata.signatureImage ||
    (field.metadata.signature && field.metadata.signature.image) ||
    (field.metadata.signature && field.metadata.signature.dataUrl) ||
    ""
  );
}

async function drawSignatureField(pdfDoc, pdfPage, field) {
  const source = getSignatureSource(field);

  if (!source) {
    return;
  }

  const image = await embedImage(pdfDoc, source);
  const control = getFieldControlElement(field);
  const box = getFieldPdfBox(pdfPage, field, control);
  const imageWidth = image.width || box.width;
  const imageHeight = image.height || box.height;
  const scale = Math.min(box.width / imageWidth, box.height / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  pdfPage.drawImage(image, {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  });
}

async function generateFilledPDF() {
  if (!originalPdfBytes) {
    throw new Error("Load the original PDF before downloading a filled copy.");
  }

  syncFieldValuesFromDom();

  const { PDFDocument, StandardFonts, rgb } = getPdfWriterLibrary();
  const pdfDoc = await PDFDocument.load(copyPdfBytes(originalPdfBytes));
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const color = rgb(15 / 255, 23 / 255, 42 / 255);
  const pdfPages = pdfDoc.getPages();

  for (const field of fields) {
    const pdfPage = pdfPages[field.page - 1];

    if (!pdfPage) {
      continue;
    }

    if (field.type === "checkbox") {
      drawCheckboxField(pdfPage, field, color);
    } else if (field.type === "signature") {
      await drawSignatureField(pdfDoc, pdfPage, field);
    } else {
      drawTextField(pdfPage, field, font, color);
    }
  }

  return pdfDoc.save();
}

function triggerPdfDownload(pdfBytes, fileName) {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function downloadFilledPDF() {
  const button = document.getElementById("download-pdf");
  const originalText = button ? button.textContent : "";

  if (fields.length === 0) {
    setFormError("No fields are available to download.");
    return;
  }

  if (!validateFields()) {
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Generating...";
    }

    const pdfBytes = await generateFilledPDF();
    triggerPdfDownload(pdfBytes, originalPdfName);
    setFormError("");
  } catch (error) {
    setFormError(error.message);
  } finally {
    if (button) {
      button.disabled = !originalPdfBytes;
      button.textContent = originalText || "Download PDF";
    }
  }
}

async function submitForm() {
  if (fields.length === 0) {
    setFormError("No fields are available to submit.");
    return;
  }

  if (!validateFields()) {
    return;
  }

  try {
    for (const field of fields) {
      await saveFieldValue(field);
    }

    renderFields();
    alert("Saved");
  } catch (error) {
    setFormError(error.message);
  }
}
