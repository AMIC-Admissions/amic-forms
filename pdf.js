(function (global) {
  const DEFAULT_WORKER_SRC =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

  let currentDocument = null;
  let currentPageDimensions = [];

  function getPdfLibrary() {
    if (!global.pdfjsLib) {
      throw new Error("PDF.js is not loaded. Include pdf.min.js before pdf.js.");
    }

    if (!global.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      global.pdfjsLib.GlobalWorkerOptions.workerSrc = DEFAULT_WORKER_SRC;
    }

    return global.pdfjsLib;
  }

  function getContainer(container) {
    if (typeof container === "string") {
      return document.querySelector(container);
    }

    return container || document.getElementById("pdf-container");
  }

  function showMessage(container, message, className) {
    container.innerHTML = "";

    const messageEl = document.createElement("div");
    messageEl.className = className || "pdf-message";
    messageEl.textContent = message;
    container.appendChild(messageEl);
  }

  function getAvailableWidth(container) {
    const containerStyles = global.getComputedStyle(container);
    const horizontalPadding =
      parseFloat(containerStyles.paddingLeft) + parseFloat(containerStyles.paddingRight);
    const width = container.clientWidth - horizontalPadding;

    return Number.isFinite(width) && width > 0 ? width : 0;
  }

  function createPageShell(pageNumber, viewport) {
    const pageEl = document.createElement("section");
    pageEl.className = "pdf-page";
    pageEl.dataset.pageNumber = String(pageNumber);
    pageEl.style.width = `${viewport.width}px`;
    pageEl.style.height = `${viewport.height}px`;

    const canvas = document.createElement("canvas");
    canvas.className = "pdf-page-canvas";
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const fieldLayer = document.createElement("div");
    fieldLayer.className = "field-layer";
    fieldLayer.dataset.pageNumber = String(pageNumber);

    pageEl.append(canvas, fieldLayer);

    return { pageEl, canvas };
  }

  function updatePageMetadata(container, pages) {
    const renderedWidth = Math.max(...pages.map((page) => page.renderedWidth), 0);
    const renderedHeight = pages.reduce((sum, page) => sum + page.renderedHeight, 0);

    container.dataset.pageCount = String(pages.length);
    container.dataset.renderedWidth = String(Math.round(renderedWidth));
    container.dataset.renderedHeight = String(Math.round(renderedHeight));
    global.amicPageDimensions = pages;
  }

  async function renderPage(page, pageNumber, pagesEl, scale) {
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale });
    const { pageEl, canvas } = createPageShell(pageNumber, viewport);
    const context = canvas.getContext("2d");
    const outputScale = global.devicePixelRatio || 1;

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);

    await page.render({
      canvasContext: context,
      viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
    }).promise;

    const pageDimensions = {
      pageNumber,
      width: baseViewport.width,
      height: baseViewport.height,
      renderedWidth: viewport.width,
      renderedHeight: viewport.height,
      scale,
    };

    pageEl.dataset.width = String(pageDimensions.width);
    pageEl.dataset.height = String(pageDimensions.height);
    pageEl.dataset.renderedWidth = String(pageDimensions.renderedWidth);
    pageEl.dataset.renderedHeight = String(pageDimensions.renderedHeight);
    pageEl.dataset.scale = String(pageDimensions.scale);
    pagesEl.appendChild(pageEl);

    return pageDimensions;
  }

  async function loadPDF(source, options) {
    const settings = Object.assign({ scale: 1, fitWidth: true }, options);
    const container = getContainer(settings.container);

    if (!container) {
      throw new Error("PDF container was not found.");
    }

    const pdfjsLib = getPdfLibrary();
    showMessage(container, "Loading PDF...");

    const loadingTask =
      typeof source === "string" ? pdfjsLib.getDocument(source) : pdfjsLib.getDocument({ data: source });
    const pdfDocument = await loadingTask.promise;
    const availableWidth = getAvailableWidth(container);
    const pagesEl = document.createElement("div");
    const pages = [];

    pagesEl.className = "pdf-pages";
    container.innerHTML = "";
    container.appendChild(pagesEl);

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale =
        settings.fitWidth && availableWidth && baseViewport.width > availableWidth
          ? availableWidth / baseViewport.width
          : settings.scale;

      pages.push(await renderPage(page, pageNumber, pagesEl, fitScale));
    }

    currentDocument = pdfDocument;
    currentPageDimensions = pages;
    updatePageMetadata(container, pages);

    const detail = {
      document: pdfDocument,
      pages: pages.slice(),
      sourceName: settings.sourceName || "",
    };

    container.dispatchEvent(new CustomEvent("amic:pdf-rendered", { detail }));
    document.dispatchEvent(new CustomEvent("amic:pdf-rendered", { detail }));

    return {
      document: pdfDocument,
      pages: pages.slice(),
      container,
    };
  }

  async function loadPDFFile(file, options) {
    if (!file) {
      throw new Error("No PDF file was selected.");
    }

    const data = await file.arrayBuffer();
    return loadPDF(data, Object.assign({ sourceName: file.name }, options));
  }

  function loadPDFUrl(url, options) {
    if (!url) {
      throw new Error("No PDF URL was provided.");
    }

    return loadPDF(url, Object.assign({ sourceName: url }, options));
  }

  function getPageDimensions() {
    return currentPageDimensions.slice();
  }

  async function generatePDF() {
    return {
      document: currentDocument,
      pages: getPageDimensions(),
    };
  }

  global.AmicPDF = {
    loadPDF,
    loadPDFFile,
    loadPDFUrl,
    getPageDimensions,
  };
  global.generatePDF = generatePDF;
})(window);
