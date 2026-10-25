/**
 * Exact-size printing for tools that lay things out on paper (passport photos, ID cards …).
 *
 * Every page is rendered by the tool as ONE full-page image at 300 DPI, then printed through a
 * hidden iframe whose @page size equals the paper and has no margins. Because the whole page
 * is a single image, nothing can shift or reflow — as long as the print dialog is set to
 * "Scale: 100% / Actual size" and "Margins: None", the printed size is exact.
 *
 * The same pages can be saved as a PDF at the exact paper size (pagesToPdf), which is the most
 * reliable route for print shops and for printers whose drivers ignore @page.
 */

export type Paper = {
  id: string;
  label: string;
  /** millimetres, portrait */
  w: number;
  h: number;
};

export const PAPERS: Paper[] = [
  { id: "a4", label: "A4 (210 × 297 mm)", w: 210, h: 297 },
  { id: "letter", label: "Letter (8.5 × 11 in)", w: 215.9, h: 279.4 },
  { id: "4x6", label: "4 × 6 in photo paper (102 × 152 mm)", w: 101.6, h: 152.4 },
  { id: "5x7", label: "5 × 7 in photo paper (127 × 178 mm)", w: 127, h: 177.8 },
  { id: "a5", label: "A5 (148 × 210 mm)", w: 148, h: 210 },
  { id: "legal", label: "Legal (8.5 × 14 in)", w: 215.9, h: 355.6 },
];

export const PAPER_MAP: Record<string, Paper> = Object.fromEntries(PAPERS.map((p) => [p.id, p]));

export const DPI = 300;
export const mmToPx = (mm: number, dpi = DPI) => Math.round((mm / 25.4) * dpi);
export const mmToPt = (mm: number) => (mm / 25.4) * 72;

/** A blank white canvas the exact size of the paper at 300 DPI (orientation applied). */
export function paperCanvas(paper: Paper, landscape = false) {
  const wMm = landscape ? paper.h : paper.w;
  const hMm = landscape ? paper.w : paper.h;
  const canvas = document.createElement("canvas");
  canvas.width = mmToPx(wMm);
  canvas.height = mmToPx(hMm);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot create images.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx, wMm, hMm, px: (mm: number) => (mm / 25.4) * DPI };
}

/** Light grey corner crop marks around a rectangle (all values in canvas pixels). */
export function drawCropMarks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const len = mmToPx(3);
  const off = mmToPx(1);
  ctx.save();
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = Math.max(1, mmToPx(0.15));
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ] as const) {
    ctx.moveTo(cx + dx * off, cy);
    ctx.lineTo(cx + dx * (off + len), cy);
    ctx.moveTo(cx, cy + dy * off);
    ctx.lineTo(cx, cy + dy * (off + len));
  }
  ctx.stroke();
  ctx.restore();
}

/** Thin dashed cutting guide around a rectangle (canvas pixels). */
export function drawCutLine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = Math.max(1, mmToPx(0.12));
  ctx.setLineDash([mmToPx(1.2), mmToPx(1)]);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

export type PrintPage = { canvas: HTMLCanvasElement; wMm: number; hMm: number };

const toBlobUrl = (c: HTMLCanvasElement) =>
  new Promise<string>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error("Could not render the page."))), "image/png"),
  );

/**
 * Opens the browser print dialog for the given full-page images at their exact size.
 * Resolves once the dialog has been opened. All pages must share one paper size.
 */
export async function printPages(pages: PrintPage[], title = "SnapGrab print") {
  if (!pages.length) throw new Error("Nothing to print.");
  const { wMm, hMm } = pages[0];
  const urls = await Promise.all(pages.map((p) => toBlobUrl(p.canvas)));

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) throw new Error("Printing is blocked in this browser.");

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "")}</title><style>
    @page { size: ${wMm}mm ${hMm}mm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    img { display: block; width: ${wMm}mm; height: ${hMm}mm; page-break-after: always; break-after: page; }
    img:last-child { page-break-after: auto; break-after: auto; }
  </style></head><body>${urls.map((u) => `<img src="${u}" alt="">`).join("")}</body></html>`);
  doc.close();

  await Promise.all(
    [...doc.images].map((img) => (img.complete ? Promise.resolve() : new Promise((r) => ((img.onload = r), (img.onerror = r))))),
  );

  const cleanup = () => {
    setTimeout(() => {
      frame.remove();
      urls.forEach((u) => URL.revokeObjectURL(u));
    }, 1000);
  };
  frame.contentWindow.addEventListener("afterprint", cleanup, { once: true });
  // some mobile browsers never fire afterprint; clean up eventually anyway
  setTimeout(cleanup, 120_000);
  frame.contentWindow.focus();
  frame.contentWindow.print();
}

/** Same pages as a PDF at the exact paper size (one JPEG per page, ~300 DPI). */
export async function pagesToPdf(pages: PrintPage[], quality = 0.92): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const p of pages) {
    const dataUrl = p.canvas.toDataURL("image/jpeg", quality);
    const img = await pdf.embedJpg(dataUrl);
    const page = pdf.addPage([mmToPt(p.wMm), mmToPt(p.hMm)]);
    page.drawImage(img, { x: 0, y: 0, width: mmToPt(p.wMm), height: mmToPt(p.hMm) });
  }
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/** Print-dialog advice shown next to every Print button. */
export const PRINT_TIPS = [
  "In the print dialog choose Scale: 100% (or “Actual size”) — not “Fit to page”.",
  "Set Margins to None (or Minimum) and turn off headers and footers.",
  "Pick the same paper size in the printer settings as here.",
];
