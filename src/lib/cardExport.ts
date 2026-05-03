import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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

/**
 * Download a single card (front+back) as PDF on A4.
 */
export async function downloadCardPdf(frontEl: HTMLElement, backEl: HTMLElement, filename: string) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = 297;
  const pageH = 210;
  const cardW = 85.6;
  const cardH = 54;

  // Front
  const frontCanvas = await captureCardCanvas(frontEl);
  const frontImg = frontCanvas.toDataURL("image/png");
  const xCenter = (pageW - cardW) / 2;
  const yFront = (pageH / 2 - cardH) / 2;
  pdf.addImage(frontImg, "PNG", xCenter, yFront, cardW, cardH);

  // Back
  const backCanvas = await captureCardCanvas(backEl);
  const backImg = backCanvas.toDataURL("image/png");
  const yBack = pageH / 2 + (pageH / 2 - cardH) / 2;
  pdf.addImage(backImg, "PNG", xCenter, yBack, cardW, cardH);

  // Crop marks
  drawCropMarks(pdf, xCenter, yFront, cardW, cardH);
  drawCropMarks(pdf, xCenter, yBack, cardW, cardH);

  pdf.save(`${filename}.pdf`);
}

function drawCropMarks(pdf: jsPDF, x: number, y: number, w: number, h: number) {
  const m = 3;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.1);
  // corners
  [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) => {
    pdf.line(cx - m, cy, cx - 1, cy);
    pdf.line(cx + 1, cy, cx + m, cy);
    pdf.line(cx, cy - m, cx, cy - 1);
    pdf.line(cx, cy + 1, cx, cy + m);
  });
}

/**
 * Generate a batch PDF with multiple cards (4 per page).
 */
export async function generateBatchPdf(
  cardElements: { front: HTMLElement; back: HTMLElement }[]
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const cardW = 85.6;
  const cardH = 54;
  const gap = 6;
  const marginX = (pageW - cardW * 2 - gap) / 2;
  const marginY = 20;

  const positions = [
    { x: marginX, y: marginY },
    { x: marginX + cardW + gap, y: marginY },
    { x: marginX, y: marginY + cardH + gap },
    { x: marginX + cardW + gap, y: marginY + cardH + gap },
  ];

  // Fronts page, then backs page
  for (let pageStart = 0; pageStart < cardElements.length; pageStart += 4) {
    const batch = cardElements.slice(pageStart, pageStart + 4);

    if (pageStart > 0) pdf.addPage();
    // Fronts
    for (let i = 0; i < batch.length; i++) {
      const canvas = await captureCardCanvas(batch[i].front);
      const img = canvas.toDataURL("image/png");
      pdf.addImage(img, "PNG", positions[i].x, positions[i].y, cardW, cardH);
      drawCropMarks(pdf, positions[i].x, positions[i].y, cardW, cardH);
    }

    // Backs on next page
    pdf.addPage();
    for (let i = 0; i < batch.length; i++) {
      const canvas = await captureCardCanvas(batch[i].back);
      const img = canvas.toDataURL("image/png");
      pdf.addImage(img, "PNG", positions[i].x, positions[i].y, cardW, cardH);
      drawCropMarks(pdf, positions[i].x, positions[i].y, cardW, cardH);
    }
  }

  return pdf.output("blob");
}
