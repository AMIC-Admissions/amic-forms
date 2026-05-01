let fields = [];
let pageDimensions = [];

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
}

function getSelectedPage() {
  const pageSelect = document.getElementById("field-page");
  const pageNumber = Number(pageSelect.value || 1);

  return pageDimensions.find((page) => page.pageNumber === pageNumber) || pageDimensions[0];
}

function getFieldLayer(pageNumber) {
  return document.querySelector(`.pdf-page[data-page-number="${pageNumber}"] .field-layer`);
}

function toPdfCoordinates(page, box) {
  return {
    pdfX: box.x / page.scale,
    pdfY: box.y / page.scale,
    pdfWidth: box.width / page.scale,
    pdfHeight: box.height / page.scale,
  };
}

function addField(type) {
  const page = getSelectedPage();

  if (!page) {
    alert("Load a PDF before adding fields.");
    return;
  }

  const layer = getFieldLayer(page.pageNumber);

  if (!layer) {
    alert("The selected PDF page is not ready yet.");
    return;
  }

  const fieldSize =
    type === "signature" ? { width: 180, height: 56 } : { width: 120, height: 28 };
  const x = Math.max(0, Math.min(100, page.renderedWidth - fieldSize.width));
  const y = Math.max(0, Math.min(100, page.renderedHeight - fieldSize.height));
  const el = document.createElement("div");
  const key = `${type}${Date.now()}`;
  const box = Object.assign({ x, y }, fieldSize);
  const pdfBox = toPdfCoordinates(page, box);

  el.innerText = type;
  el.className = `amic-field amic-field-${type}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${fieldSize.width}px`;
  el.style.height = `${fieldSize.height}px`;
  el.dataset.key = key;
  el.dataset.pageNumber = String(page.pageNumber);
  layer.appendChild(el);

  fields.push({
    type,
    key,
    page: page.pageNumber,
    x,
    y,
    width: fieldSize.width,
    height: fieldSize.height,
    ...pdfBox,
  });
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
        "amic_documentid@odata.bind": `/amic_documents(${id})`,
      }),
    });
  }

  alert("Saved");
}
