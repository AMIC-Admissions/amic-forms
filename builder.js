let fields = [];
let pageDimensions = [];

const FIELD_DEFAULTS = {
  text: { x: 10, y: 10, width: 20, height: 4 },
  signature: { x: 10, y: 10, width: 30, height: 8 },
};

const GEOMETRY_PRECISION = 4;

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("pdf-file");
  const params = new URLSearchParams(location.search);
  const pdfUrl = params.get("pdf") || params.get("url");

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

  if (pdfUrl) {
    renderPDFUrl(pdfUrl).catch((error) => alert(error.message));
  }
});

async function renderPDFFile(file) {
  const result = await AmicPDF.loadPDFFile(file, { container: "#pdf-container" });
  fields = [];
  updatePageDimensions(result.pages);
}

async function renderPDFUrl(url) {
  const result = await AmicPDF.loadPDFUrl(url, { container: "#pdf-container" });
  fields = [];
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

function normalizeBox(box) {
  const width = clamp(box.width, 0, 100);
  const height = clamp(box.height, 0, 100);

  return {
    x: roundPercent(clamp(box.x, 0, 100 - width)),
    y: roundPercent(clamp(box.y, 0, 100 - height)),
    width: roundPercent(width),
    height: roundPercent(height),
  };
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
    type,
    key,
    page: page.pageNumber,
    ...normalizeBox(box),
  };
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

  el.innerText = field.type;
  el.className = `amic-field amic-field-${field.type}`;
  el.dataset.key = field.key;
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
  renderField(field);
}

async function save() {
  const id = new URLSearchParams(location.search).get("id");

  for (const f of fields) {
    await fetch("/_api/amic_fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amic_key: f.key,
        amic_type: f.type,
        amic_x: f.x,
        amic_y: f.y,
        amic_width: f.width,
        amic_height: f.height,
        amic_pagenumber: f.page,
        "amic_documentid@odata.bind": `/amic_documents(${id})`,
      }),
    });
  }

  alert("Saved");
}
