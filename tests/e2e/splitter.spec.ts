import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createPacketPdf, fixturePageText } from './fixture';

interface ExtractedPdf {
  filename: string;
  pageCount: number;
  text: string[];
}

async function extractZipPdfs(path: string): Promise<ExtractedPdf[]> {
  const zipBytes = await readFile(path);
  const zip = new ZipReader(new BlobReader(new Blob([zipBytes])));
  const entries = (await zip.getEntries()).filter((entry) => !entry.directory);
  const extracted: ExtractedPdf[] = [];

  try {
    for (const entry of entries) {
      const blob = await entry.getData!(new BlobWriter('application/pdf'));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const reopened = await PDFDocument.load(bytes);
      const loadingTask = getDocument({ data: bytes });
      const document = await loadingTask.promise;
      const text: string[] = [];

      try {
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          text.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
        }
      } finally {
        await loadingTask.destroy();
      }

      extracted.push({ filename: entry.filename, pageCount: reopened.getPageCount(), text });
    }
  } finally {
    await zip.close();
  }

  return extracted.sort((left, right) => left.text[0].localeCompare(right.text[0]));
}

test('splits a local PDF into safe, downloadable PDFs without uploading it', async ({ page }) => {
  const unexpectedDocumentRequests: string[] = [];
  page.on('request', (request) => {
    if (!['fetch', 'xhr'].includes(request.resourceType())) return;
    const url = new URL(request.url());
    const isLocalAsset = url.origin === 'http://127.0.0.1:4173';
    const isRead = request.method() === 'GET' || request.method() === 'HEAD';
    if (!isLocalAsset || !isRead) unexpectedDocumentRequests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto('/');
  unexpectedDocumentRequests.length = 0;

  await page.getByLabel('PDF file', { exact: true }).setInputFiles({
    name: 'meeting packets.pdf',
    mimeType: 'application/pdf',
    buffer: await createPacketPdf(),
  });

  await expect(page.getByText('4 of 4 pages', { exact: true })).toBeVisible();
  await expect(page.getByText(fixturePageText[0], { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh sample' }).click();
  await page.getByRole('button', { name: 'Inspect page 4' }).click();
  await expect(page.getByText(fixturePageText[3], { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to find starts' }).click();

  await page.getByRole('tab', { name: 'Text' }).click();
  await page.getByLabel('Start phrase').fill('detail page');
  await page.getByRole('button', { name: 'Add phrase' }).click();

  const zoom = page.locator('.page-grid').getByRole('button', { name: 'View page 2 large' });
  await zoom.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  const markPageThree = page.getByRole('button', { name: 'Mark page 3 as start' });
  await markPageThree.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove page 3 as start' })).toBeVisible();

  await page.getByRole('button', { name: 'Continue to download' }).click();
  const firstName = page.getByLabel('Filename for document starting page 1');
  const secondName = page.getByLabel('Filename for document starting page 3');
  await expect(firstName).toBeVisible();
  await expect(secondName).toBeVisible();
  await expect(page.getByLabel('Filename for document starting page 2')).toHaveCount(0);
  await expect(page.getByLabel('Filename for document starting page 4')).toHaveCount(0);
  await firstName.fill('../same.pdf');
  await secondName.fill('same.pdf');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download all as ZIP' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const outputs = await extractZipPdfs(downloadPath!);
  expect(outputs).toHaveLength(2);
  expect(new Set(outputs.map(({ filename }) => filename)).size).toBe(2);
  for (const { filename } of outputs) {
    expect(filename).toMatch(/\.pdf$/i);
    expect(filename).not.toMatch(/[\\/]/);
    expect(filename).not.toContain('..');
  }
  expect(outputs.map(({ pageCount }) => pageCount)).toEqual([2, 2]);
  expect(outputs.map(({ text }) => text)).toEqual([
    [expect.stringContaining(fixturePageText[0]), expect.stringContaining(fixturePageText[1])],
    [expect.stringContaining(fixturePageText[2]), expect.stringContaining(fixturePageText[3])],
  ]);

  expect(unexpectedDocumentRequests).toEqual([]);
});
