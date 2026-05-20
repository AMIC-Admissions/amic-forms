import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const PDFJS_VERSION = '5.6.205';

const AMIRI_FONT_URL =
  'https://cdn.jsdelivr.net/npm/@fontsource/amiri@5.0.15/files/amiri-arabic-400-normal.woff';

let amiriFontCache: ArrayBuffer | null = null;

async function loadAmiriFont(): Promise<ArrayBuffer | null> {
  if (amiriFontCache) return amiriFontCache;
  try {
    const res = await fetch(AMIRI_FONT_URL);
    if (!res.ok) throw new Error('fetch failed');
    amiriFontCache = await res.arrayBuffer();
    return amiriFontCache;
  } catch {
    return null;
  }
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/** Detect whether a template uses the legacy % coordinate system. */
function isLegacyPercent(field: { x: number; width: number; unit?: string }): boolean {
  return field.unit !== 'pt' && field.x <= 100 && field.width <= 100;
}

export async function loadPDF(base64: string): Promise<pdfjsLib.PDFDocumentProxy> {
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
    disableRange: false,
    disableStream: false,
    enableXfa: false,
  }).promise;
}

export async function renderPageToCanvas(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale = 1.5
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNum);
  const dpr = window.devicePixelRatio || 1;

  const viewport = page.getViewport({ scale: scale * dpr });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const cssW = viewport.width / dpr;
  const cssH = viewport.height / dpr;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.style.display = 'block';

  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
    intent: 'display',
    annotationMode: pdfjsLib.AnnotationMode.DISABLE,
  }).promise;

  return { width: cssW, height: cssH };
}

export async function generateSignedPDF(
  base64PDF: string,
  formData: Record<string, string>,
  signatureDataUrl: string | null,
  fields: Array<{
    id: string;
    type: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
    unit?: string;
    linkedGroup?: string;
    radioGroup?: string;
  }>,
  referenceNumber: string
): Promise<string> {
  const base64Data = base64PDF.includes(',') ? base64PDF.split(',')[1] : base64PDF;
  const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const amiriBytes = await loadAmiriFont();
  let arabicFont: Awaited<ReturnType<typeof pdfDoc.embedFont>> | null = null;
  if (amiriBytes) {
    try {
      arabicFont = await pdfDoc.embedFont(new Uint8Array(amiriBytes), { subset: false });
    } catch {
      arabicFont = null;
    }
  }

  for (const field of fields) {
    const pageIndex = (field.page || 1) - 1;
    if (pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const { width: pageW, height: pageH } = page.getSize();

    let x: number, y: number, fieldW: number, fieldH: number;

    if (isLegacyPercent(field)) {
      // Legacy: coordinates stored as percentages 0–100
      x = (field.x / 100) * pageW;
      fieldW = (field.width / 100) * pageW;
      fieldH = (field.height / 100) * pageH;
      // y=0 is top in old system
      y = pageH - (field.y / 100) * pageH - fieldH;
    } else {
      // New: coordinates stored as PDF points from top-left
      x = field.x;
      fieldW = field.width;
      fieldH = field.height;
      // Flip: pdf-lib y=0 is bottom, our storage y=0 is top
      y = pageH - field.y - fieldH;
    }

    let value = formData[field.id] ?? '';

    if (!value && field.linkedGroup) {
      const linked = fields.find(f => f.linkedGroup === field.linkedGroup && f.id !== field.id && formData[f.id]);
      if (linked) value = formData[linked.id] ?? '';
    }

    if (field.type === 'signature') {
      if (signatureDataUrl) {
        try {
          const sigData = signatureDataUrl.split(',')[1];
          const sigBytes = Uint8Array.from(atob(sigData), c => c.charCodeAt(0));
          const sigImage = await pdfDoc.embedPng(sigBytes);
          page.drawImage(sigImage, { x, y, width: fieldW, height: fieldH });
        } catch {
          // skip
        }
      }
    } else if (field.type === 'initials') {
      // If value is short uppercase text (≤5 chars), draw as text; otherwise treat as signature image
      if (value && value.length <= 5 && /^[A-Z]+$/.test(value)) {
        const fontSize = Math.min(12, Math.max(8, fieldH * 0.55));
        try {
          page.drawText(value, { x: x + 2, y: y + (fieldH - fontSize) / 2, size: fontSize, font: latinFont, color: rgb(0.05, 0.05, 0.05) });
        } catch { /* skip */ }
      } else if (signatureDataUrl) {
        try {
          const sigData = signatureDataUrl.split(',')[1];
          const sigBytes = Uint8Array.from(atob(sigData), c => c.charCodeAt(0));
          const sigImage = await pdfDoc.embedPng(sigBytes);
          page.drawImage(sigImage, { x, y, width: fieldW, height: fieldH });
        } catch { /* skip */ }
      }
    } else if (field.type === 'stamp') {
      if (signatureDataUrl) {
        try {
          const sigData = signatureDataUrl.split(',')[1];
          const sigBytes = Uint8Array.from(atob(sigData), c => c.charCodeAt(0));
          const sigImage = await pdfDoc.embedPng(sigBytes);
          page.drawImage(sigImage, { x, y, width: fieldW, height: fieldH });
        } catch {
          // draw stamp circle placeholder
          page.drawEllipse({ x: x + fieldW / 2, y: y + fieldH / 2, xScale: fieldW / 2, yScale: fieldH / 2, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 1 });
        }
      }
    } else if (field.type === 'attachment') {
      continue;
    } else if (field.type === 'checkbox') {
      const checked = value === 'true';
      const boxSize = Math.min(fieldH * 0.65, 10);
      const bx = x + 2;
      const by = y + (fieldH - boxSize) / 2;
      page.drawRectangle({
        x: bx, y: by, width: boxSize, height: boxSize,
        borderColor: rgb(0, 0, 0), borderWidth: 0.75,
        color: checked ? rgb(0, 0, 0) : rgb(1, 1, 1),
      });
      if (checked) {
        try {
          page.drawText('\u2713', { x: bx + 0.5, y: by + 1, size: boxSize - 2, font: latinFont, color: rgb(1, 1, 1) });
        } catch {
          page.drawLine({ start: { x: bx + 1, y: by + boxSize / 2 }, end: { x: bx + boxSize / 3, y: by + 1.5 }, thickness: 1, color: rgb(1, 1, 1) });
          page.drawLine({ start: { x: bx + boxSize / 3, y: by + 1.5 }, end: { x: bx + boxSize - 1, y: by + boxSize - 1 }, thickness: 1, color: rgb(1, 1, 1) });
        }
      }
    } else if (field.type === 'radio') {
      const selected = value === 'true' || value === field.id;
      const r = Math.min(fieldH * 0.35, 5);
      const cx = x + r + 2;
      const cy = y + fieldH / 2;
      page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r, borderColor: rgb(0, 0, 0), borderWidth: 0.75, color: rgb(1, 1, 1) });
      if (selected) {
        page.drawEllipse({ x: cx, y: cy, xScale: r * 0.55, yScale: r * 0.55, borderColor: rgb(0, 0, 0), borderWidth: 0, color: rgb(0, 0, 0) });
      }
    } else if (value) {
      const isArabic = hasArabic(value);
      const font = isArabic && arabicFont ? arabicFont : latinFont;

      if (isArabic && !arabicFont) {
        page.drawLine({
          start: { x: x + 2, y: y + fieldH / 2 },
          end: { x: x + Math.min(fieldW - 4, value.length * 5), y: y + fieldH / 2 },
          thickness: 0.75,
          color: rgb(0.1, 0.1, 0.1),
        });
        continue;
      }

      const fontSize = Math.min(11, Math.max(7, fieldH * 0.45));
      const textToDraw = value.replace(/\r/g, '');
      const lines = textToDraw.split('\n');
      let lineY = y + fieldH - fontSize - 1;

      for (const line of lines) {
        if (lineY < y - 1) break;
        if (!line.trim()) { lineY -= fontSize + 2; continue; }
        try {
          const maxChars = Math.floor(fieldW / (fontSize * (isArabic ? 0.65 : 0.55)));
          const truncated = line.length > maxChars ? line.slice(0, maxChars - 1) + '…' : line;
          const drawX = isArabic ? x + fieldW - (truncated.length * fontSize * 0.6) : x + 2;
          page.drawText(truncated, {
            x: Math.max(x + 1, drawX),
            y: lineY,
            size: fontSize,
            font,
            color: rgb(0.05, 0.05, 0.05),
          });
        } catch {
          // skip non-embeddable chars
        }
        lineY -= fontSize + 2;
      }
    }
  }

  if (pages.length > 0) {
    const lastPage = pages[pages.length - 1];
    const { width: pw } = lastPage.getSize();
    try {
      lastPage.drawText(`Ref: ${referenceNumber}`, {
        x: pw - 130, y: 16, size: 7.5,
        font: latinFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    } catch {
      // skip
    }
  }

  const resultBytes = await pdfDoc.save();
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < resultBytes.length; i += chunkSize) {
    binary += String.fromCharCode(...resultBytes.subarray(i, i + chunkSize));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

/**
 * Convert a base64 PDF data URL to a Blob.
 */
export function pdfBase64ToBlob(base64DataUrl: string): Blob {
  const base64 = base64DataUrl.includes(',') ? base64DataUrl.split(',')[1] : base64DataUrl;
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new Blob([bytes], { type: 'application/pdf' });
}
