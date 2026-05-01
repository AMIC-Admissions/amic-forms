let fields = [];
let pageDimensions = [];

const FIELD_DEFAULTS = {
  text: { x: 10, y: 10, width: 20, height: 4 },
  signature: { x: 10, y: 10, width: 30, height: 8 },
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
];

const GEOMETRY_PRECISION = 4;

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("pdf-file");
  const params = new URLSearchParams(location.search);
  const pdfUrl = params.get("pdf") || params.get("url");
  const documentId = getDocumentId();

  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    try {
      await renderPDFFile(file);
    } catch (error) {
      alert(error.message);
    }
  });

  if (documentId) {
    loadFields(documentId).catch((error) => alert(error.message));
  }

  if (pdfUrl) {
    renderPDFUrl(pdfUrl).catch((error) => alert(error.message));
  }
});

function getDocumentId() {
  return sanitizeId(new URLSearchParams(location.search).get("id"));
}

function sanitizeId(id) {
  return (id || "").replace(/[{}]/g, "");
}

async function renderPDFFile(file) {
  const result = await AmicPDF.loadPDFFile(file, { container: "#pdf-container" });
  updatePageDimensions(result.pages);
}

async function renderPDFUrl(url) {
  const result = await AmicPDF.loadPDFUrl(url, { container: "#pdf-container" });
  updatePageDimensions(result.pages);
}

function updatePageDimensions(pages) {
  pageDimensions = pages;
  window.amicPageDimensions = pages;

  const pageSelect = document.getElementById("field-page");
  pageSelect.innerHTML = "";

  pages.forEach((page) => {
    const option = document.createElement("option");
    option.value = String(page.pageNumber);
    option.textContent = `Page ${page.pageNumber} (${Math.round(page.width)} x ${Math.round(page.height)})`;
    pageSelect.appendChild(option);
  });

  pageSelect.disabled = pages.length === 0;
  renderFields();
}

function getSelectedPage() {
  const pageSelect = document.getElementById("field-page");
  const pageNumber = Number(pageSelect.value || 1);

  return pageDimensions.find((page) => page.pageNumber === pageNumber) || pageDimensions[0];
}

function getFieldLayer(pageNumber) {
  return document.querySelector(`.pdf-page[data-page-number="${pageNumber}"] .field-layer`);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundPercent(value) {
  return Number(value.toFixed(GEOMETRY_PRECISION));
}

function toNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function normalizeBox(box) {
  const width = clamp(toNumber(box.width, 0), 0, 100);
  const height = clamp(toNumber(box.height, 0), 0, 100);

  return {
    x: roundPercent(clamp(toNumber(box.x, 0), 0, 100 - width)),
    y: roundPercent(clamp(toNumber(box.y, 0), 0, 100 - height)),
    width: roundPercent(width),
    height: roundPercent(height),
  };
}

function createMetadata(type, metadata) {
  return Object.assign(
    {
      label: type,
      required: false,
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

function applyFieldBox(el, box) {
  el.style.left = `${box.x}%`;
  el.style.top = `${box.y}%`;
  el.style.width = `${box.width}%`;
  el.style.height = `${box.height}%`;
}

function getFieldByKey(key) {
  return fields.find((field) => field.key === key);
}

function updateFieldBox(key, box) {
  const field = getFieldByKey(key);

  if (!field) {
    return;
  }

  Object.assign(field, normalizeBox(box));
}

function createFieldRecord(type, page, box) {
  const key = `${type}${Date.now()}`;

  return {
    id: "",
    type,
    key,
    page: page.pageNumber,
    metadata: createMetadata(type, {
      createdAt: new Date().toISOString(),
    }),
    ...normalizeBox(box),
  };
}

function fieldFromBackend(row) {
  const type = row.amic_type || "text";
  const defaults = FIELD_DEFAULTS[type] || FIELD_DEFAULTS.text;
  const page = Math.max(1, Math.round(toNumber(row.amic_pagenumber, 1)));

  return {
    id: row.amic_fieldid || "",
    type,
    key: row.amic_key || `${type}${Date.now()}`,
    page,
    metadata: parseMetadata(row.amic_metadata, type),
    ...normalizeBox({
      x: toNumber(row.amic_x, defaults.x),
      y: toNumber(row.amic_y, defaults.y),
      width: toNumber(row.amic_width, defaults.width),
      height: toNumber(row.amic_height, defaults.height),
    }),
  };
}

function sortFields(a, b) {
  return a.page - b.page || a.y - b.y || a.x - b.x || a.key.localeCompare(b.key);
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
  const loadedFields = (data.value || []).map(fieldFromBackend).sort(sortFields);
  const loadedKeys = new Set(loadedFields.map((field) => field.key));
  const localUnsavedFields = fields.filter((field) => !field.id && !loadedKeys.has(field.key));

  fields = loadedFields.concat(localUnsavedFields);
  window.amicFields = fields;
  renderFields();
}

function clearRenderedFields() {
  document.querySelectorAll(".field-layer .amic-field").forEach((fieldEl) => fieldEl.remove());
}

function renderFields() {
  clearRenderedFields();
  fields.forEach(renderField);
}

function attachDragHandler(el) {
  el.addEventListener("pointerdown", (event) => {
    const field = getFieldByKey(el.dataset.key);
    const layer = el.closest(".field-layer");

    if (!field || !layer) {
      return;
    }

    event.preventDefault();
    el.setPointerCapture(event.pointerId);

    const layerRect = layer.getBoundingClientRect();
    const start = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: field.x,
      y: field.y,
    };

    function handlePointerMove(moveEvent) {
      const deltaX = ((moveEvent.clientX - start.pointerX) / layerRect.width) * 100;
      const deltaY = ((moveEvent.clientY - start.pointerY) / layerRect.height) * 100;
      const nextBox = normalizeBox({
        x: start.x + deltaX,
        y: start.y + deltaY,
        width: field.width,
        height: field.height,
      });

      updateFieldBox(field.key, nextBox);
      applyFieldBox(el, nextBox);
    }

    function handlePointerUp() {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerup", handlePointerUp);
      el.removeEventListener("pointercancel", handlePointerUp);
    }

    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerup", handlePointerUp);
    el.addEventListener("pointercancel", handlePointerUp);
  });
}

function renderField(field) {
  const layer = getFieldLayer(field.page);

  if (!layer) {
    return;
  }

  const el = document.createElement("div");

  el.innerText = field.metadata.label || field.type;
  el.className = `amic-field amic-field-${field.type}`;
  el.dataset.key = field.key;
  el.dataset.fieldId = field.id;
  el.dataset.pageNumber = String(field.page);
  applyFieldBox(el, field);
  attachDragHandler(el);
  layer.appendChild(el);
}

function addField(type) {
  const page = getSelectedPage();

  if (!page) {
    alert("Load a PDF before adding fields.");
    return;
  }

  if (!getFieldLayer(page.pageNumber)) {
    alert("The selected PDF page is not ready yet.");
    return;
  }

  const field = createFieldRecord(type, page, FIELD_DEFAULTS[type] || FIELD_DEFAULTS.text);
  fields.push(field);
  window.amicFields = fields;
  renderField(field);
}

function buildFieldPayload(field, documentId, includeDocumentBinding) {
  const payload = {
    amic_key: field.key,
    amic_type: field.type,
    amic_x: field.x,
    amic_y: field.y,
    amic_width: field.width,
    amic_height: field.height,
    amic_pagenumber: field.page,
    amic_metadata: JSON.stringify(field.metadata || createMetadata(field.type)),
  };

  if (includeDocumentBinding) {
    payload["amic_documentid@odata.bind"] = `/amic_documents(${sanitizeId(documentId)})`;
  }

  return payload;
}

function getRecordIdFromHeader(response) {
  const entityUrl = response.headers.get("OData-EntityId") || response.headers.get("Location");
  const match = entityUrl && entityUrl.match(/\(([^)]+)\)$/);

  return match ? sanitizeId(match[1]) : "";
}

async function readResponseJson(response) {
  const text = await response.text();

  return text.trim() ? JSON.parse(text) : null;
}

async function saveField(field, documentId) {
  const isExisting = Boolean(field.id);
  const response = await fetch(
    isExisting ? `/_api/amic_fields(${sanitizeId(field.id)})` : "/_api/amic_fields",
    {
      method: isExisting ? "PATCH" : "POST",
      headers: isExisting
        ? { "Content-Type": "application/json", "If-Match": "*" }
        : { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(buildFieldPayload(field, documentId, !isExisting)),
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to save field ${field.key}: ${await response.text()}`);
  }

  if (!isExisting) {
    const saved = await readResponseJson(response);
    field.id = (saved && saved.amic_fieldid) || getRecordIdFromHeader(response);
  }
}

async function save() {
  const documentId = getDocumentId();

  if (!documentId) {
    alert("Document id is required before fields can be saved.");
    return;
  }

  try {
    for (const field of fields) {
      await saveField(field, documentId);
    }

    await loadFields(documentId);
    alert("Saved");
  } catch (error) {
    alert(error.message);
  }
}
