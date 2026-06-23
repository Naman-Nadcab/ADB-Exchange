/**
 * Lightweight tabular-report PDF generator built on pdf-lib (pure JS, no native deps).
 * Renders a titled, paginated table from an array of flat row objects.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

const PAGE_W = 842; // A4 landscape
const PAGE_H = 595;
const MARGIN = 40;
const HEADER_FONT_SIZE = 8;
const ROW_FONT_SIZE = 7.5;
const ROW_HEIGHT = 14;

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

export async function rowsToPdf(title: string, rows: Record<string, unknown>[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
  const usableWidth = PAGE_W - MARGIN * 2;
  const colWidth = columns.length > 0 ? usableWidth / columns.length : usableWidth;
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const drawTitleBlock = () => {
    page.drawText(title, { x: MARGIN, y: y - 10, size: 16, font: bold, color: rgb(0.1, 0.1, 0.12) });
    page.drawText(`Generated: ${generatedAt}   ·   Rows: ${rows.length}`, {
      x: MARGIN, y: y - 26, size: 9, font, color: rgb(0.45, 0.45, 0.5),
    });
    y -= 48;
  };

  const drawHeaderRow = () => {
    page.drawRectangle({ x: MARGIN, y: y - ROW_HEIGHT + 3, width: usableWidth, height: ROW_HEIGHT, color: rgb(0.93, 0.94, 0.96) });
    columns.forEach((c, i) => {
      page.drawText(truncateToWidth(c, bold, HEADER_FONT_SIZE, colWidth - 6), {
        x: MARGIN + i * colWidth + 3, y: y - ROW_HEIGHT + 7, size: HEADER_FONT_SIZE, font: bold, color: rgb(0.2, 0.2, 0.25),
      });
    });
    y -= ROW_HEIGHT;
  };

  drawTitleBlock();

  if (columns.length === 0) {
    page.drawText('No data available for this report.', { x: MARGIN, y: y - 10, size: 11, font, color: rgb(0.5, 0.5, 0.55) });
    return Buffer.from(await doc.save());
  }

  drawHeaderRow();

  for (const row of rows) {
    if (y < MARGIN + ROW_HEIGHT) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      drawHeaderRow();
    }
    columns.forEach((c, i) => {
      const raw = row[c];
      const val = raw === null || raw === undefined ? '' : String(raw);
      page.drawText(truncateToWidth(val, font, ROW_FONT_SIZE, colWidth - 6), {
        x: MARGIN + i * colWidth + 3, y: y - ROW_HEIGHT + 7, size: ROW_FONT_SIZE, font, color: rgb(0.15, 0.15, 0.18),
      });
    });
    page.drawLine({ start: { x: MARGIN, y: y - ROW_HEIGHT + 2 }, end: { x: PAGE_W - MARGIN, y: y - ROW_HEIGHT + 2 }, thickness: 0.3, color: rgb(0.88, 0.88, 0.9) });
    y -= ROW_HEIGHT;
  }

  return Buffer.from(await doc.save());
}
