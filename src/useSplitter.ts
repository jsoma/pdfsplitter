import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { openPdf, type PdfSource } from './pdf';
import { exportPdf, exportZip } from './export';
import { matchPages, splitRanges } from './matching';
import type { Method, OutputDocument, PageInfo, PageLabel, PhraseRule, Progress, SplitterController } from './types';

type Decisions = { confirmed: number[]; rejected: number[] };
type PreviewSession = {
  abort: AbortController;
  popup: Window;
  url: string | null;
  monitor: number;
};
const initialDecisions = (): Decisions => ({ confirmed: [1], rejected: [] });
const defaultFilenameTemplate = '{name}_{index}_pages_{start}-{end}.pdf';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function changedDecisionPage(current: Decisions, restored: Decisions): number | null {
  const candidates = new Set([
    ...current.confirmed,
    ...current.rejected,
    ...restored.confirmed,
    ...restored.rejected,
  ]);
  return [...candidates].sort((left, right) => left - right).find((page) => (
    current.confirmed.includes(page) !== restored.confirmed.includes(page)
    || current.rejected.includes(page) !== restored.rejected.includes(page)
  )) ?? null;
}

export function useSplitter(): SplitterController {
  const source = useRef<PdfSource | null>(null);
  const preparation = useRef<AbortController | null>(null);
  const exportingJob = useRef<AbortController | null>(null);
  const downloadUrl = useRef<string | null>(null);
  const previewSessions = useRef(new Set<PreviewSession>());
  const [phase, setPhase] = useState<SplitterController['phase']>('upload');
  const [filename, setFilename] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [preparingProgress, setPreparingProgress] = useState<Progress | null>(null);
  const [exportProgress, setExportProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<Decisions[]>([initialDecisions()]);
  const { confirmed, rejected } = history[history.length - 1];
  const [method, setMethod] = useState<Method>('visual');
  const [threshold, setThreshold] = useState(80);
  const [phrases, setPhrases] = useState<PhraseRule[]>([]);
  const [filenameTemplate, setFilenameTemplate] = useState(defaultFilenameTemplate);

  const dispose = useCallback(() => {
    preparation.current?.abort();
    exportingJob.current?.abort();
    exportingJob.current = null;
    source.current?.dispose();
    source.current = null;
    if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
    downloadUrl.current = null;
  }, []);
  useEffect(() => dispose, [dispose]);

  const releasePreview = useCallback((session: PreviewSession) => {
    window.clearInterval(session.monitor);
    if (session.url) URL.revokeObjectURL(session.url);
    previewSessions.current.delete(session);
  }, []);
  useEffect(() => () => {
    for (const session of previewSessions.current) {
      if (session.url) continue;
      session.abort.abort();
      session.popup.close();
      releasePreview(session);
    }
  }, [releasePreview]);

  const reset = useCallback(() => {
    dispose();
    setPhase('upload'); setFilename(''); setPageCount(0); setPages([]);
    setPreparingProgress(null); setExportProgress(null); setError(null);
    setLoading(false); setExporting(false); setHistory([initialDecisions()]);
    setMethod('visual'); setThreshold(80); setPhrases([]); setFilenameTemplate(defaultFilenameTemplate);
  }, [dispose]);

  const open = useCallback(async (file: File) => {
    reset();
    const job = new AbortController();
    preparation.current = job;
    setLoading(true);
    try {
      const pdf = await openPdf(file, job.signal);
      if (job.signal.aborted) { pdf.dispose(); return; }
      source.current = pdf;
      setFilename(file.name); setPageCount(pdf.pageCount); setPhase('inspect'); setLoading(false);
      for (let number = 1; number <= pdf.pageCount; number++) {
        setPreparingProgress({ completed: number - 1, total: pdf.pageCount, label: 'Reading pages' });
        const page = await pdf.inspectPage(number, job.signal);
        if (job.signal.aborted) return;
        setPages(previous => [...previous, page]);
      }
    } catch (failure) {
      if (!job.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (!job.signal.aborted) { setLoading(false); setPreparingProgress(null); }
    }
  }, [reset]);

  const matches = useMemo(() => pageCount ? matchPages({ pages, pageCount, confirmed, rejected, threshold, phrases, method }) : { pages: [], suggested: [], unsure: [], kinds: [] },
    [pages, pageCount, confirmed, rejected, threshold, phrases, method]);
  const documents = useMemo(() => (pageCount ? splitRanges(pageCount, confirmed, filename) : []).map((document, index) => {
    const values = {
      name: filename.replace(/\.pdf$/i, ''),
      index: String(index + 1).padStart(3, '0'),
      start: String(document.start).padStart(3, '0'),
      end: String(document.end).padStart(3, '0'),
    };
    return { ...document, filename: (filenameTemplate || defaultFilenameTemplate).replace(/\{(name|index|start|end)\}/g,
      (_, key: keyof typeof values) => values[key]) };
  }), [pageCount, confirmed, filename, filenameTemplate]);

  const label = useCallback((page: number, value: PageLabel) => {
    if (page <= 1 || page > pageCount) return;
    setHistory(previous => {
      const last = previous[previous.length - 1];
      const next = { confirmed: last.confirmed.filter(n => n !== page), rejected: last.rejected.filter(n => n !== page) };
      if (value === 'start') next.confirmed.push(page);
      if (value === 'not-start') next.rejected.push(page);
      next.confirmed.sort((a, b) => a - b); next.rejected.sort((a, b) => a - b);
      return [...previous, next];
    });
  }, [pageCount]);
  const acceptAll = useCallback(() => {
    if (!matches.suggested.length) return;
    setHistory(previous => {
      const last = previous[previous.length - 1];
      return [...previous, { ...last, confirmed: [...new Set([...last.confirmed, ...matches.suggested])].sort((a, b) => a - b) }];
    });
  }, [matches.suggested]);
  const undo = useCallback((): number | null => {
    if (history.length <= 1) return null;
    const current = history[history.length - 1];
    const restored = history[history.length - 2];
    setHistory(history.slice(0, -1));
    return changedDecisionPage(current, restored);
  }, [history]);
  const cancelExport = useCallback(() => exportingJob.current?.abort(), []);

  const previewDocument = useCallback((document: OutputDocument) => {
    const pdf = source.current;
    if (!pdf) return;

    const popup = window.open('', '_blank');
    if (!popup) {
      setError('The PDF preview was blocked. Allow popups for this site and try again.');
      return;
    }

    setError(null);
    popup.opener = null;
    popup.document.title = document.filename;
    const status = popup.document.createElement('p');
    status.textContent = 'Preparing PDF preview…';
    status.style.cssText = 'font:16px system-ui,sans-serif;padding:32px;color:#292421';
    popup.document.body.replaceChildren(status);

    const abort = new AbortController();
    const session: PreviewSession = { abort, popup, url: null, monitor: 0 };
    session.monitor = window.setInterval(() => {
      if (!popup.closed) return;
      abort.abort();
      releasePreview(session);
    }, 750);
    previewSessions.current.add(session);

    void exportPdf(pdf.bytes, document, abort.signal).then((blob) => {
      if (popup.closed || abort.signal.aborted) {
        releasePreview(session);
        return;
      }
      const url = URL.createObjectURL(blob);
      session.url = url;
      popup.location.replace(url);
    }).catch((failure) => {
      popup.close();
      releasePreview(session);
      if (!abort.signal.aborted) setError(`The PDF preview could not be opened. ${errorMessage(failure)}`);
    });
  }, [releasePreview]);

  const download = useCallback(async () => {
    if (!source.current || exportingJob.current) return;
    const job = new AbortController();
    exportingJob.current = job;
    setExporting(true); setError(null);
    setExportProgress({ completed: 0, total: documents.length, label: 'Preparing export' });
    try {
      const blob = await exportZip(source.current.bytes, documents, progress => {
        if (!job.signal.aborted) setExportProgress(progress);
      }, job.signal);
      if (job.signal.aborted) return;
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
      const url = URL.createObjectURL(blob);
      downloadUrl.current = url;
      const link = document.createElement('a');
      link.href = url; link.download = `${filename.replace(/\.pdf$/i, '') || 'documents'}_split.zip`;
      link.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        if (downloadUrl.current === url) downloadUrl.current = null;
      }, 30_000);
    } catch (failure) {
      if (!job.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (exportingJob.current === job) {
        exportingJob.current = null; setExporting(false); setExportProgress(null);
      }
    }
  }, [documents, filename]);
  const render = useCallback(async (page: number, canvas: HTMLCanvasElement, width: number, signal?: AbortSignal) => {
    if (!source.current) return;
    await source.current.render(page, canvas, width, signal);
  }, []);

  return { phase, filename, pageCount, pages, progress: exporting ? exportProgress : preparingProgress, error, loading, exporting,
    confirmed, rejected, method, threshold, phrases, matches, documents, open, reset, setPhase, setMethod,
    setThreshold, setPhrases, label, acceptAll, undo, canUndo: history.length > 1, filenameTemplate, setFilenameTemplate,
    previewDocument, download, cancelExport, render };
}
