import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const fixturePageText = [
  'Packet Alpha cover',
  'Alpha detail page',
  'Packet Beta cover',
  'Beta detail page',
] as const;

export async function createPacketPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (const [index, text] of fixturePageText.entries()) {
    const page = pdf.addPage([420, 594]);
    page.drawText(text, {
      x: 48,
      y: 510,
      size: 20,
      font,
      color: rgb(0.08, 0.12, 0.18),
    });
    page.drawText(`Fixture page ${index + 1}`, {
      x: 48,
      y: 70,
      size: 11,
      font,
      color: rgb(0.3, 0.35, 0.4),
    });
  }

  return Buffer.from(await pdf.save());
}
