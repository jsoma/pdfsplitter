import {
  getDocument,
  GlobalWorkerOptions,
  InvalidPDFException,
  PasswordException,
  RenderingCancelledException,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { perceptualHash } from './matching';
import type { PageInfo } from './types';

export interface PdfSource {
  name: string;
  pageCount: number;
  bytes: Uint8Array;
  inspectPage(page: number, signal?: AbortSignal): Promise<PageInfo>;
  render(page: number, canvas: HTMLCanvasElement, width: number, signal?: AbortSignal): Promise<void>;
  dispose(): void;
}

interface ActiveRender {
  task?: RenderTask;
  token: symbol;
}

const THUMBNAIL_WIDTH = 240;
const HASH_SIZE = 64;
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function localPdfAssetUrl(directory: string): string {
  return new URL(`${import.meta.env.BASE_URL}pdfjs/${directory}/`, document.baseURI).href;
}

function abortError(message = 'The operation was cancelled.'): DOMException {
  return new DOMException(message, 'AbortError');
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : abortError();
  }
}

function friendlyOpenError(error: unknown): Error {
  if (error instanceof PasswordException || (error instanceof Error && error.name === 'PasswordException')) {
    return new Error('This PDF is password-protected. Remove the password and try again.');
  }
  if (error instanceof InvalidPDFException || (error instanceof Error && error.name === 'InvalidPDFException')) {
    return new Error('This file is not a valid PDF or is damaged.');
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return error;
  }
  return new Error('The PDF could not be opened. It may be damaged or use an unsupported format.');
}

async function loadDocument(bytes: Uint8Array, signal?: AbortSignal): Promise<PDFDocumentProxy> {
  assertNotAborted(signal);
  const loadingTask: PDFDocumentLoadingTask = getDocument({
    // PDF.js transfers this buffer to its worker. Keep the original byte array
    // owned by PdfSource so a later export still has intact source bytes.
    data: bytes.slice(),
    cMapUrl: localPdfAssetUrl('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: localPdfAssetUrl('standard_fonts'),
    wasmUrl: localPdfAssetUrl('wasm'),
    useWorkerFetch: true,
  });

  let rejectAbort: ((reason: DOMException) => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => {
    void loadingTask.destroy().catch(() => undefined);
    rejectAbort?.(abortError());
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const document = await Promise.race([loadingTask.promise, aborted]);
    assertNotAborted(signal);
    return document;
  } catch (error) {
    await loadingTask.destroy().catch(() => undefined);
    throw friendlyOpenError(error);
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

function pageText(items: Awaited<ReturnType<PDFPageProxy['getTextContent']>>['items']): string {
  const lines: string[] = [];
  let line = '';

  for (const item of items) {
    if (!('str' in item)) continue;
    const text = item.str;
    if (text) {
      if (line && !/\s$/.test(line) && !/^\s/.test(text)) line += ' ';
      line += text;
    }
    if (item.hasEOL) {
      lines.push(line.trimEnd());
      line = '';
    }
  }
  if (line) lines.push(line.trimEnd());
  return lines.join('\n').trim();
}

function hashCanvas(canvas: HTMLCanvasElement): number[] {
  const hashCanvas = document.createElement('canvas');
  hashCanvas.width = HASH_SIZE;
  hashCanvas.height = HASH_SIZE;
  const context = hashCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas rendering is unavailable in this browser.');
  context.drawImage(canvas, 0, 0, HASH_SIZE, HASH_SIZE);
  const rgba = context.getImageData(0, 0, HASH_SIZE, HASH_SIZE).data;
  const grayscale = new Uint8Array(HASH_SIZE * HASH_SIZE);
  for (let source = 0, target = 0; target < grayscale.length; source += 4, target += 1) {
    grayscale[target] = Math.round(
      rgba[source] * 0.299 + rgba[source + 1] * 0.587 + rgba[source + 2] * 0.114,
    );
  }
  return perceptualHash(grayscale);
}

function validatePageNumber(page: number, pageCount: number): void {
  if (!Number.isInteger(page) || page < 1 || page > pageCount) {
    throw new RangeError(`Page ${page} is outside this ${pageCount}-page PDF.`);
  }
}

class BrowserPdfSource implements PdfSource {
  readonly name: string;
  readonly pageCount: number;
  readonly bytes: Uint8Array;

  private readonly document: PDFDocumentProxy;
  private readonly activeRenders = new WeakMap<HTMLCanvasElement, ActiveRender>();
  private disposed = false;

  constructor(name: string, bytes: Uint8Array, document: PDFDocumentProxy) {
    this.name = name;
    this.bytes = bytes;
    this.document = document;
    this.pageCount = document.numPages;
  }

  async inspectPage(pageNumber: number, signal?: AbortSignal): Promise<PageInfo> {
    this.assertUsable();
    validatePageNumber(pageNumber, this.pageCount);
    assertNotAborted(signal);

    const page = await this.document.getPage(pageNumber);
    assertNotAborted(signal);
    const originalViewport = page.getViewport({ scale: 1 });
    const thumbnail = document.createElement('canvas');
    try {
      await this.renderPdfPage(page, thumbnail, THUMBNAIL_WIDTH, signal);
      const text = pageText((await page.getTextContent()).items);
      assertNotAborted(signal);

      return {
        number: pageNumber,
        width: originalViewport.width,
        height: originalViewport.height,
        text,
        thumbnail: thumbnail.toDataURL('image/png'),
        signature: hashCanvas(thumbnail),
      };
    } finally {
      page.cleanup();
    }
  }

  async render(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    width: number,
    signal?: AbortSignal,
  ): Promise<void> {
    this.assertUsable();
    validatePageNumber(pageNumber, this.pageCount);
    if (!Number.isFinite(width) || width <= 0) throw new RangeError('Render width must be positive.');
    assertNotAborted(signal);

    const previous = this.activeRenders.get(canvas);
    previous?.task?.cancel();
    const token = Symbol('render');
    this.activeRenders.set(canvas, { token });

    let page: PDFPageProxy | undefined;
    try {
      page = await this.document.getPage(pageNumber);
      assertNotAborted(signal);
      if (this.activeRenders.get(canvas)?.token !== token) throw abortError('The render was superseded.');
      const staging = document.createElement('canvas');
      await this.renderPdfPage(page, staging, width, signal, { output: canvas, token });
    } finally {
      page?.cleanup();
      if (this.activeRenders.get(canvas)?.token === token) this.activeRenders.delete(canvas);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    void this.document.loadingTask.destroy().catch(() => undefined);
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error('This PDF has already been closed.');
  }

  private async renderPdfPage(
    page: PDFPageProxy,
    staging: HTMLCanvasElement,
    width: number,
    signal?: AbortSignal,
    destination?: { output: HTMLCanvasElement; token: symbol },
  ): Promise<void> {
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / unscaled.width });
    staging.width = Math.max(1, Math.round(viewport.width));
    staging.height = Math.max(1, Math.round(viewport.height));
    const context = staging.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas rendering is unavailable in this browser.');

    const task = page.render({ canvas: staging, canvasContext: context, viewport });
    if (destination) {
      const current = this.activeRenders.get(destination.output);
      if (current?.token !== destination.token) {
        task.cancel();
        throw abortError('The render was superseded.');
      }
      this.activeRenders.set(destination.output, { task, token: destination.token });
    }
    const onAbort = () => task.cancel();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      await task.promise;
      assertNotAborted(signal);
      if (destination) {
        const current = this.activeRenders.get(destination.output);
        if (current?.token !== destination.token) throw abortError('The render was superseded.');
        destination.output.width = staging.width;
        destination.output.height = staging.height;
        const outputContext = destination.output.getContext('2d', { alpha: false });
        if (!outputContext) throw new Error('Canvas rendering is unavailable in this browser.');
        outputContext.drawImage(staging, 0, 0);
      }
    } catch (error) {
      if (
        error instanceof RenderingCancelledException ||
        (error instanceof Error && error.name === 'RenderingCancelledException')
      ) {
        throw abortError(signal?.aborted ? 'The render was cancelled.' : 'The render was superseded.');
      }
      throw error;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      if (destination && this.activeRenders.get(destination.output)?.token === destination.token) {
        this.activeRenders.delete(destination.output);
      }
    }
  }
}

export async function openPdf(file: File, signal?: AbortSignal): Promise<PdfSource> {
  assertNotAborted(signal);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    if (signal?.aborted) throw abortError();
    throw new Error('The selected file could not be read.', { cause: error });
  }
  assertNotAborted(signal);
  if (bytes.byteLength === 0) throw new Error('The selected PDF is empty.');

  const document = await loadDocument(bytes, signal);
  return new BrowserPdfSource(file.name, bytes, document);
}
