import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/** Print layout configuration */
export interface PrintLayoutOptions {
  /** Card width in mm (CR80 = 85.6) */
  cardWidth: number;
  /** Card height in mm (CR80 = 54) */
  cardHeight: number;
  /** Page margin in mm */
  margin: number;
  /** Gap between cards in mm */
  gap: number;
  /** Columns per page */
  cols: number;
  /** Rows per page */
  rows: number;
  /** Show crop marks */
  cropMarks: boolean;
  /** Page orientation */
  orientation: "portrait" | "landscape";
}

export const DEFAULT_PRINT_LAYOUT: PrintLayoutOptions = {
  cardWidth: 85.6,
  cardHeight: 54,
  margin: 10,
  gap: 4,
  cols: 2,
  rows: 4,
  cropMarks: true,
  orientation: "portrait",
};

/** Presets for common print layouts */
export const PRINT_PRESETS: Record<string, PrintLayoutOptions> = {
  "2x4 A4 Portrait": { ...DEFAULT_PRINT_LAYOUT },
  "2x3 A4 Portrait": { ...DEFAULT_PRINT_LAYOUT, rows: 3 },
  "1x2 A4 Landscape": { cardWidth: 85.6, cardHeight: 54, margin: 15, gap: 10, cols: 1, rows: 2, cropMarks: true, orientation: "landscape" },
  "1x1 A4 Landscape (Centrado)": { cardWidth: 85.6, cardHeight: 54, margin: 10, gap: 0, cols: 1, rows: 1, cropMarks: true, orientation: "landscape" },
};

/**
 * Capture a card element to a canvas at high DPI.
 */
export async function captureCardCanvas(element: HTMLElement, scaleFactor = 3): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    scale: scaleFactor,
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    logging: false,
  });
}

/**
 * Download a single card as PNG.
 */
export async function downloadCardPng(element: HTMLElement, filename: string) {
  const canvas = await captureCardCanvas(element);
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function getPageSize(orientation: "portrait" | "landscape"): { w: number; h: number } {
  return orientation === "portrait" ? { w: 210, h: 297 } : { w: 297, h: 210 };
}

function computePositions(opts: PrintLayoutOptions): { x: number; y: number }[] {
  const page = getPageSize(opts.orientation);
  const totalW = opts.cols * opts.cardWidth + (opts.cols - 1) * opts.gap;
  const totalH = opts.rows * opts.cardHeight + (opts.rows - 1) * opts.gap;
  const startX = Math.max(opts.margin, (page.w - totalW) / 2);
  const startY = Math.max(opts.margin, (page.h - totalH) / 2);

  const positions: { x: number; y: number }[] = [];
  for (let r = 0; r < opts.rows; r++) {
    for (let c = 0; c < opts.cols; c++) {
      positions.push({
        x: startX + c * (opts.cardWidth + opts.gap),
        y: startY + r * (opts.cardHeight + opts.gap),
      });
    }
  }
  return positions;
}

function drawCropMarks(pdf: jsPDF, x: number, y: number, w: number, h: number) {
  const m = 3;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.1);
  [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) => {
    pdf.line(cx - m, cy, cx - 1, cy);
    pdf.line(cx + 1, cy, cx + m, cy);
    pdf.line(cx, cy - m, cx, cy - 1);
    pdf.line(cx, cy + 1, cx, cy + m);
  });
}

/**
 * Download a single card (front+back) as PDF.
 */
export async function downloadCardPdf(
  frontEl: HTMLElement,
  backEl: HTMLElement,
  filename: string,
  opts: PrintLayoutOptions = DEFAULT_PRINT_LAYOUT
) {
  const pdf = new jsPDF({ orientation: opts.orientation, unit: "mm", format: "a4" });
  const page = getPageSize(opts.orientation);
  const xCenter = (page.w - opts.cardWidth) / 2;
  const yFront = (page.h / 2 - opts.cardHeight) / 2;
  const yBack = page.h / 2 + (page.h / 2 - opts.cardHeight) / 2;

  const frontCanvas = await captureCardCanvas(frontEl);
  pdf.addImage(frontCanvas.toDataURL("image/png"), "PNG", xCenter, yFront, opts.cardWidth, opts.cardHeight);
  if (opts.cropMarks) drawCropMarks(pdf, xCenter, yFront, opts.cardWidth, opts.cardHeight);

  const backCanvas = await captureCardCanvas(backEl);
  pdf.addImage(backCanvas.toDataURL("image/png"), "PNG", xCenter, yBack, opts.cardWidth, opts.cardHeight);
  if (opts.cropMarks) drawCropMarks(pdf, xCenter, yBack, opts.cardWidth, opts.cardHeight);

  pdf.save(`${filename}.pdf`);
}

/**
 * Generate a batch PDF with configurable layout.
 */
export async function generateBatchPdf(
  cardElements: { front: HTMLElement; back: HTMLElement }[],
  opts: PrintLayoutOptions = DEFAULT_PRINT_LAYOUT
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: opts.orientation, unit: "mm", format: "a4" });
  const perPage = opts.cols * opts.rows;
  const positions = computePositions(opts);

  for (let pageStart = 0; pageStart < cardElements.length; pageStart += perPage) {
    const batch = cardElements.slice(pageStart, pageStart + perPage);

    if (pageStart > 0) pdf.addPage();
    // Fronts
    for (let i = 0; i < batch.length; i++) {
      const canvas = await captureCardCanvas(batch[i].front);
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", positions[i].x, positions[i].y, opts.cardWidth, opts.cardHeight);
      if (opts.cropMarks) drawCropMarks(pdf, positions[i].x, positions[i].y, opts.cardWidth, opts.cardHeight);
    }

    // Backs on next page (mirrored column order for duplex printing)
    pdf.addPage();
    for (let i = 0; i < batch.length; i++) {
      const canvas = await captureCardCanvas(batch[i].back);
      // Mirror column position for correct duplex alignment
      const row = Math.floor(i / opts.cols);
      const col = i % opts.cols;
      const mirroredCol = opts.cols - 1 - col;
      const mirroredIdx = row * opts.cols + mirroredCol;
      const pos = positions[mirroredIdx] || positions[i];
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", pos.x, pos.y, opts.cardWidth, opts.cardHeight);
      if (opts.cropMarks) drawCropMarks(pdf, pos.x, pos.y, opts.cardWidth, opts.cardHeight);
    }
  }

  return pdf.output("blob");
}
