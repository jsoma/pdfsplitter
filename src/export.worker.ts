/// <reference lib="webworker" />

import { BlobWriter, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js';
import { PDFDocument } from 'pdf-lib';
import type { OutputDocument, Progress } from './types';

declare const self: DedicatedWorkerGlobalScope;

interface ExportRequest {
  bytes: ArrayBuffer;
  documents: OutputDocument[];
}

const ILLEGAL_FILENAME = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;
const TRAILING_DOTS_OR_SPACES = /[. ]+$/;
const PDF_EXTENSION = /\.pdf$/i;
const MAX_FILENAME_LENGTH = 180;
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function safeFilename(requested: string, index: number): string {
  let base = requested.trim().replace(ILLEGAL_FILENAME, '_').replace(TRAILING_DOTS_OR_SPACES, '');
  if (PDF_EXTENSION.test(base)) base = base.slice(0, -4);
  base = base.replace(/^\.+/, '').replace(TRAILING_DOTS_OR_SPACES, '');
  if (!base || base === '.' || base === '..') base = `document-${index + 1}`;
  if (WINDOWS_RESERVED_NAME.test(base)) base = `_${base}`;
  base = base.slice(0, MAX_FILENAME_LENGTH - 4).replace(TRAILING_DOTS_OR_SPACES, '');
  return `${base || `document-${index + 1}`}.pdf`;
}

function uniqueFilename(requested: string, index: number, used: Set<string>): string {
  const safe = safeFilename(requested, index);
  const base = safe.slice(0, -4);
  let candidate = safe;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const label = ` (${suffix})`;
    candidate = `${base.slice(0, MAX_FILENAME_LENGTH - 4 - label.length)}${label}.pdf`;
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function validateDocument(document: OutputDocument, pageCount: number): void {
  if (
    !Number.isInteger(document.start) ||
    !Number.isInteger(document.end) ||
    document.start < 1 ||
    document.end < document.start ||
    document.end > pageCount
  ) {
    throw new RangeError(`Invalid page range ${document.start}-${document.end} for a ${pageCount}-page PDF.`);
  }
}

function report(progress: Progress): void {
  self.postMessage({ type: 'progress', progress });
}

self.onmessage = async ({ data }: MessageEvent<ExportRequest>) => {
  try {
    if (!data.documents.length) throw new Error('There are no documents to export.');
    const source = await PDFDocument.load(data.bytes);
    const total = data.documents.length;
    const usedNames = new Set<string>();
    const blobWriter = new BlobWriter('application/zip');
    // This module is already a dedicated worker; nested compression workers
    // add lifecycle complexity and can trigger extra script requests.
    const zip = new ZipWriter(blobWriter, { useWebWorkers: false });

    report({ completed: 0, total, label: 'Preparing export' });
    for (let index = 0; index < total; index += 1) {
      const descriptor = data.documents[index];
      validateDocument(descriptor, source.getPageCount());
      const filename = uniqueFilename(descriptor.filename, index, usedNames);
      report({ completed: index, total, label: `Creating ${filename}` });

      const output = await PDFDocument.create();
      const pageIndices = Array.from(
        { length: descriptor.end - descriptor.start + 1 },
        (_, offset) => descriptor.start - 1 + offset,
      );
      const pages = await output.copyPages(source, pageIndices);
      for (const page of pages) output.addPage(page);
      const pdfBytes = await output.save();
      await zip.add(filename, new Uint8ArrayReader(pdfBytes));
      report({ completed: index + 1, total, label: `Added ${filename}` });
    }

    const blob = await zip.close();
    self.postMessage({ type: 'done', blob });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The export failed.';
    self.postMessage({ type: 'error', message });
  }
};

export {};
