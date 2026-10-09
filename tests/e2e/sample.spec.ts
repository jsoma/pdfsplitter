import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js';
import { PDFDocument } from 'pdf-lib';

const expectedPageCounts = [3, 5, 2, 4, 6, 3, 4, 3];

async function zipPdfPageCounts(path: string): Promise<number[]> {
  const zipBytes = await readFile(path);
  const zip = new ZipReader(new BlobReader(new Blob([zipBytes])));
  try {
    const entries = (await zip.getEntries())
      .filter((entry) => !entry.directory)
      .sort((left, right) => left.filename.localeCompare(right.filename));
    return await Promise.all(entries.map(async (entry) => {
      const blob = await entry.getData!(new BlobWriter('application/pdf'));
      return (await PDFDocument.load(await blob.arrayBuffer())).getPageCount();
    }));
  } finally {
    await zip.close();
  }
}

test('bundled sample demonstrates text matching and exports eight documents', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');

  await page.getByRole('button', { name: 'Try a sample PDF' }).click();
  await expect(page.getByText('30 pages', { exact: true })).toBeVisible();
  await expect(page.getByText('30 of 30 pages', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to find starts' }).click();

  const review = page.locator('.review-card');
  await expect(review.getByRole('button', { name: 'View page 1 large', exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(review.getByRole('button', { name: 'View page 4 large', exact: true })).toBeVisible();
  await expect(review.getByRole('button', { name: 'Undo last decision' })).toBeDisabled();
  await review.getByRole('button', { name: 'Yes, starts here' }).click();
  await expect(page.getByRole('button', { name: 'Page 4, document start', exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Undo last decision' }).click();
  await expect(review.getByRole('button', { name: 'View page 4 large', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Page 4, document start', exact: true })).toHaveCount(0);
  await review.getByRole('button', { name: 'No', exact: true }).click();
  await review.getByRole('button', { name: 'Undo last decision' }).click();
  await expect(review.getByRole('button', { name: 'View page 4 large', exact: true })).toBeVisible();

  const first = page.locator('.page-tile').filter({ has: page.getByRole('button', { name: 'Page 1, document start', exact: true }) });
  const middle = page.locator('.page-tile').filter({ has: page.getByRole('button', { name: 'Page 2', exact: true }) });
  const last = page.locator('.page-tile').filter({ has: page.getByRole('button', { name: 'Page 3', exact: true }) });
  await expect(first.locator('.doc-connector.right')).toHaveCount(1);
  await expect(first.locator('.doc-connector:not(.right)')).toHaveCount(0);
  await expect(middle.locator('.doc-connector')).toHaveCount(2);
  await expect(last.locator('.doc-connector.right')).toHaveCount(0);
  await expect(last.locator('.doc-connector:not(.right)')).toHaveCount(1);
  await review.getByRole('button', { name: 'Skip to next review page' }).click();
  await expect(review.getByRole('button', { name: 'View page 9 large', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Text' }).click();
  await page.getByLabel('Start phrase').fill('PROCUREMENT REQUEST');
  await page.getByRole('button', { name: 'Add phrase' }).click();
  await expect(page.getByText('1 marked · 7 to review (7 suggested)', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Unsure 7', exact: true })).toBeVisible();

  const footer = page.locator('.app-footer');
  await footer.getByRole('button', { name: 'Accept all 7 suggestions' }).click();
  await expect(page.getByText('8 marked · 0 to review (0 suggested)', { exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Undo last decision' }).click();
  await expect(review.getByRole('button', { name: 'View page 4 large', exact: true })).toBeVisible();
  await footer.getByRole('button', { name: 'Accept all 7 suggestions' }).click();
  await page.getByRole('button', { name: 'Continue to download' }).click();
  await expect(page.getByRole('heading', { name: '8 documents' })).toBeVisible();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open document 1 as PDF', exact: true }).click();
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toMatch(/^blob:/);
  const preview = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { type: response.headers.get('content-type'), bytes: [...new Uint8Array(await response.arrayBuffer())] };
  }, popup.url());
  expect(preview.type).toBe('application/pdf');
  expect((await PDFDocument.load(new Uint8Array(preview.bytes))).getPageCount()).toBe(3);
  await popup.close();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download all as ZIP' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect(await zipPdfPageCounts(downloadPath!)).toEqual(expectedPageCounts);
});
