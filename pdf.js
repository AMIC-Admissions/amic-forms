/* ============================================================
   AMIC Forms – PDF Renderer (pdf.js)
   Uses PDF.js to render PDF pages into canvas elements.
   Exposes window.AmicPDF for use by sign.js and builder.js.
   ============================================================ */

(function (global) {
  "use strict";

  const DEFAULT_WORKER_SRC =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

  let currentDocument       = null;
  let currentPageDimensions = [];

  // ─── Library Access ──────────────────────────────────────────────────────────

  function getPdfLibrary() {
    if (!global.pdfjsLib) {
      throw new Error("PDF.js غير محمّل. تأكد من تضمين pdf.min.js قبل pdf.js.");
    }
    if (!global.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      global.pdfjsLib.GlobalWorkerOptions.workerSrc = DEFAULT_WORKER_SRC;
    }
    return global.pdfjsLib;
  }

  // ─── Container ───────────────────────────────────────────────────────────────

  function getContainer(container) {
    if (typeof container === "string") return document.querySelector(container);
    return container || document.getElementById("pdf-container");
  }

  // ─── Messages ─────────────────────────────────────────────────────────────────

  function showMessage(container, message, isLoading) {
    container.innerHTML = "";
    const div = document.createElement("div");
    div.className = "pdf-message";

    if (isLoading) {
      div.innerHTML = `<div class="pdf-loading-inner"><div class="pdf-loading-spinner"></div><span>${message}</span></div>`;
    } else {
      div.textContent = message;
    }

    container.appendChild(div);
  }

  // ─── Width Calculation ────────────────────────────────────────────────────────

  function getAvailableWidth(container) {
    const styles = global.getComputedStyle(container);
    const hPad   = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const width  = container.clientWidth - hPad;
    return Number.isFinite(width) && width > 0 ? width : 0;
  }

  // ─── Page Shell ───────────────────────────────────────────────────────────────

  function createPageShell(pageNumber, viewport) {
    const pageEl = document.createElement("section");
    pageEl.className = "pdf-page";
    pageEl.dataset.pageNumber = String(pageNumber);
    pageEl.style.width  = `${viewport.width}px`;
    pageEl.style.height = `${viewport.height}px`;

    const canvas = document.createElement("canvas");
    canvas.className = "pdf-page-canvas";
    canvas.style.width  = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const fieldLayer = document.createElement("div");
    fieldLayer.className = "field-layer";
    fieldLayer.dataset.pageNumber = String(pageNumber);

    pageEl.append(canvas, fieldLayer);
    return { pageEl, canvas };
  }

  // ─── Metadata ─────────────────────────────────────────────────────────────────

  function updatePageMetadata(container, pages) {
    const renderedWidth  = Math.max(...pages.map((p) => p.renderedWidth), 0);
    const renderedHeight = pages.reduce((sum, p) => sum + p.renderedHeight, 0);
    container.dataset.pageCount      = String(pages.length);
    container.dataset.renderedWidth  = String(Math.round(renderedWidth));
    container.dataset.renderedHeight = String(Math.round(renderedHeight));
    global.amicPageDimensions = pages;
  }

  // ─── Render Page ──────────────────────────────────────────────────────────────

  async function renderPage(page, pageNumber, pagesEl, scale) {
    const baseViewport  = page.getViewport({ scale: 1 });
    const viewport      = page.getViewport({ scale });
    const { pageEl, canvas } = createPageShell(pageNumber, viewport);
    const context       = canvas.getContext("2d");
    const outputScale   = global.devicePixelRatio || 1;

    canvas.width  = Math.floor(viewport.width  * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);

    await page.render({
      canvasContext: context,
      viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
    }).promise;

    const pageDimensions = {
      pageNumber,
      width:          baseViewport.width,
      height:         baseViewport.height,
      renderedWidth:  viewport.width,
      renderedHeight: viewport.height,
      scale,
    };

    pageEl.dataset.width          = String(pageDimensions.width);
    pageEl.dataset.height         = String(pageDimensions.height);
    pageEl.dataset.renderedWidth  = String(pageDimensions.renderedWidth);
    pageEl.dataset.renderedHeight = String(pageDimensions.renderedHeight);
    pageEl.dataset.scale          = String(pageDimensions.scale);
    pagesEl.appendChild(pageEl);

    return pageDimensions;
  }

  // ─── Load PDF ─────────────────────────────────────────────────────────────────

  async function loadPDF(source, options) {
    const settings  = Object.assign({ scale: 1, fitWidth: true }, options);
    const container = getContainer(settings.container);

    if (!container) throw new Error("لم يتم العثور على حاوية PDF.");

    const pdfjsLib = getPdfLibrary();
    showMessage(container, "جاري تحميل النموذج...", true);

    const loadingTask =
      typeof source === "string"
        ? pdfjsLib.getDocument(source)
        : pdfjsLib.getDocument({ data: source });

    const pdfDocument   = await loadingTask.promise;
    const availableWidth = getAvailableWidth(container);
    const pagesEl        = document.createElement("div");
    const pages          = [];

    pagesEl.className = "pdf-pages";
    container.innerHTML = "";
    container.appendChild(pagesEl);

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const page         = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });

      // Calculate scale: fit to available width on mobile, or use provided scale
      let fitScale = settings.scale;
      if (settings.fitWidth && availableWidth && baseViewport.width > availableWidth) {
        fitScale = availableWidth / baseViewport.width;
      }

      pages.push(await renderPage(page, pageNumber, pagesEl, fitScale));
    }

    currentDocument       = pdfDocument;
    currentPageDimensions = pages;
    updatePageMetadata(container, pages);

    const detail = {
      document:   pdfDocument,
      pages:      pages.slice(),
      sourceName: settings.sourceName || "",
    };

    container.dispatchEvent(new CustomEvent("amic:pdf-rendered", { detail, bubbles: true }));
    document.dispatchEvent(new CustomEvent("amic:pdf-rendered", { detail }));

    return { document: pdfDocument, pages: pages.slice(), container };
  }

  // ─── Convenience Wrappers ─────────────────────────────────────────────────────

  async function loadPDFFile(file, options) {
    if (!file) throw new Error("لم يتم اختيار ملف PDF.");
    const data = await file.arrayBuffer();
    return loadPDF(data, Object.assign({ sourceName: file.name }, options));
  }

  function loadPDFUrl(url, options) {
    if (!url) throw new Error("لم يتم توفير رابط PDF.");
    return loadPDF(url, Object.assign({ sourceName: url }, options));
  }

  function getPageDimensions() {
    return currentPageDimensions.slice();
  }

  // Stub – actual PDF generation is in sign.js via pdf-lib
  async function generatePDF() {
    return { document: currentDocument, pages: getPageDimensions() };
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  global.AmicPDF = {
    loadPDF,
    loadPDFFile,
    loadPDFUrl,
    getPageDimensions,
  };

  global.generatePDF = generatePDF;

})(window);
