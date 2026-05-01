let values = {};
let signatureFields = [];
const signaturePads = new Map();

const FIELD_COLUMNS = [
  "amic_fieldid",
  "amic_key",
  "amic_type",
  "amic_pagenumber",
  "amic_metadata",
];

const SIGNATURE_MAX_WIDTH = 600;
const SIGNATURE_MAX_HEIGHT = 300;
const SIGNATURE_MAX_BYTES = 250 * 1024;
const SIGNATURE_JPEG_QUALITY = 0.82;

document.addEventListener("DOMContentLoaded", () => {
  const documentId = getDocumentId();

  if (!documentId) {
    showMessage("Document id is required before signatures can be loaded.");
    return;
  }

  loadSignatureFields(documentId).catch((error) => showMessage(error.message));
});

function update(key, value) {
  values[key] = value;
  document.querySelectorAll(`[data-key="${key}"]`).forEach((element) => {
    if (element.value !== undefined) {
      element.value = value;
    }
  });
}

function getDocumentId() {
  return sanitizeId(new URLSearchParams(location.search).get("id"));
}

function sanitizeId(id) {
  return (id || "").replace(/[{}]/g, "");
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

function getSignatureImage(metadata) {
  return (
    metadata.signatureImage ||
    (metadata.signature && metadata.signature.image) ||
    (metadata.signature && metadata.signature.dataUrl) ||
    ""
  );
}

function getFieldsQuery(documentId) {
  const filter = `_amic_documentid_value eq ${sanitizeId(documentId)} and amic_type eq 'signature'`;

  return `/_api/amic_fields?$select=${FIELD_COLUMNS.join(",")}&$filter=${encodeURIComponent(filter)}`;
}

async function loadSignatureFields(documentId) {
  const response = await fetch(getFieldsQuery(documentId));

  if (!response.ok) {
    throw new Error(`Unable to load signature fields: ${await response.text()}`);
  }

  const data = await response.json();
  signatureFields = (data.value || []).map(fieldFromBackend);
  window.amicSignatureFields = signatureFields;
  renderSignatureFields();
}

function fieldFromBackend(row) {
  const type = row.amic_type || "signature";
  const metadata = parseMetadata(row.amic_metadata, type);
  const image = getSignatureImage(metadata);

  return {
    id: row.amic_fieldid || "",
    key: row.amic_key || `${type}${Date.now()}`,
    type,
    page: Number(row.amic_pagenumber || 1),
    metadata,
    image,
    locked: Boolean(image),
  };
}

function setFormError(message) {
  const errorEl = document.getElementById("form-error");

  if (!errorEl) {
    return;
  }

  errorEl.textContent = message || "";
  errorEl.hidden = !message;
}

function showMessage(message) {
  const container = document.getElementById("signature-fields");
  container.innerHTML = "";

  const messageEl = document.createElement("div");
  messageEl.className = "message";
  messageEl.textContent = message;
  container.appendChild(messageEl);
}

function renderSignatureFields() {
  const container = document.getElementById("signature-fields");
  container.innerHTML = "";
  signaturePads.clear();

  if (signatureFields.length === 0) {
    showMessage("No signature fields were found for this document.");
    return;
  }

  setFormError("");

  signatureFields.forEach((field) => {
    const card = document.createElement("section");
    const header = document.createElement("header");
    const title = document.createElement("div");
    const meta = document.createElement("div");
    const padWrap = document.createElement("div");
    const canvas = document.createElement("canvas");
    const preview = document.createElement("div");
    const signatureImg = document.createElement("img");
    const actions = document.createElement("div");
    const clearButton = document.createElement("button");
    const status = document.createElement("div");
    const error = document.createElement("div");

    card.className = "signature-card";
    card.dataset.key = field.key;
    title.className = "signature-title";
    title.textContent = field.metadata.label || "Signature";
    meta.className = "signature-meta";
    meta.textContent = `Page ${field.page}`;
    padWrap.className = "signature-pad-wrap";
    canvas.className = "signature-pad";
    canvas.dataset.key = field.key;
    canvas.dataset.fieldId = field.id;
    preview.className = "signature-preview";
    signatureImg.className = "signature-img";
    signatureImg.alt = `${field.metadata.label || "Signature"} image`;
    signatureImg.src = field.image;
    actions.className = "signature-actions";
    clearButton.type = "button";
    clearButton.textContent = "Clear";
    clearButton.addEventListener("click", () => {
      const pad = signaturePads.get(field.key);
      if (pad) {
        pad.clear();
      }
      field.image = "";
      clearFieldError(field.key);
    });
    status.className = "signed-note";
    status.textContent = getSignedStatus(field);
    error.className = "field-error";
    error.dataset.errorFor = field.key;
    error.hidden = true;

    header.append(title, meta);
    if (field.locked && field.image) {
      preview.appendChild(signatureImg);
      padWrap.appendChild(preview);
      actions.appendChild(status);
    } else {
      padWrap.appendChild(canvas);
      actions.appendChild(clearButton);
    }
    card.append(header, padWrap, actions);
    card.appendChild(error);
    container.appendChild(card);

    if (!field.locked) {
      initializeSignaturePad(field, canvas);
    }
  });
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

  if (field.image) {
    pad.fromDataURL(field.image);
  }

  pad.addEventListener("endStroke", () => {
    field.image = pad.toDataURL("image/png");
    clearFieldError(field.key);
    values[field.key] = {
      fieldId: field.id,
      image: field.image,
    };
  });

  signaturePads.set(field.key, pad);
}

function resizeSignatureCanvas(canvas) {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));

  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").scale(ratio, ratio);
}

function getDataUrlSize(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";

  return Math.ceil((base64.length * 3) / 4);
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

function setFieldError(key, message) {
  const card = document.querySelector(`.signature-card[data-key="${key}"]`);
  const errorEl = document.querySelector(`[data-error-for="${key}"]`);

  if (card) {
    card.classList.toggle("invalid", Boolean(message));
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

function validateSignatures() {
  const missingFields = signatureFields.filter((field) => !hasSignature(field));

  signatureFields.forEach((field) => clearFieldError(field.key));

  if (missingFields.length === 0) {
    setFormError("");
    return true;
  }

  missingFields.forEach((field) => {
    setFieldError(field.key, `${field.metadata.label || "Signature"} is required.`);
  });
  setFormError("Complete all required signatures before submitting.");

  const firstMissingCard = document.querySelector(
    `.signature-card[data-key="${missingFields[0].key}"]`
  );

  if (firstMissingCard) {
    firstMissingCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return false;
}

async function resizeSignatureImage(dataUrl) {
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
    pad && !pad.isEmpty() ? pad.toDataURL("image/png") : field.image || "";

  if (!image) {
    return null;
  }

  return resizeSignatureImage(image);
}

function buildSignatureMetadata(field, optimizedSignature, signedAt) {
  const metadata = Object.assign({}, field.metadata);
  delete metadata.signatureImage;

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

async function saveSignatureField(field) {
  const signedAt = new Date().toISOString();

  if (field.locked && field.image) {
    return;
  }

  const optimizedSignature = await getSignedImage(field);

  if (!field.id) {
    throw new Error(`${field.metadata.label || "Signature"} is missing a backend field id.`);
  }

  if (!optimizedSignature) {
    throw new Error(`${field.metadata.label || "Signature"} is required.`);
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
      amic_signatureimage: optimizedSignature.image,
      amic_metadata: JSON.stringify(metadata),
    },
    {
      amic_metadata: JSON.stringify(metadata),
    },
  ];

  for (const payload of payloads) {
    try {
      await patchField(field, payload);
      field.image = optimizedSignature.image;
      field.locked = true;
      field.metadata = metadata;
      values[field.key] = {
        fieldId: field.id,
        image: optimizedSignature.image,
        mimeType: optimizedSignature.mimeType,
        bytes: optimizedSignature.bytes,
        signedAt,
      };
      return;
    } catch (error) {
      if (payload === payloads[payloads.length - 1]) {
        throw new Error(`Unable to save ${field.metadata.label || "signature"}: ${error.message}`);
      }
    }
  }
}

async function submitForm() {
  if (signatureFields.length === 0) {
    setFormError("No signature fields are available to submit.");
    return;
  }

  if (!validateSignatures()) {
    return;
  }

  try {
    for (const field of signatureFields) {
      await saveSignatureField(field);
    }

    renderSignatureFields();
    alert("Saved");
  } catch (error) {
    setFormError(error.message);
  }
}
