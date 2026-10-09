import { useEffect, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import type { SplitterController } from '../types';

export function UploadView({ controller }: { controller: SplitterController }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sampleRequest = useRef<AbortController | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const busy = controller.loading || sampleLoading;

  useEffect(() => () => sampleRequest.current?.abort(), []);

  // Listen while the upload view is mounted so the header and empty space
  // accept files too. Removing the listeners protects an open packet.
  useEffect(() => {
    const enter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      if (!busy) setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!event.relatedTarget) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file && !busy) {
        setSampleError(null);
        void controller.open(file);
      }
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [busy, controller.open]);

  const open = (file?: File) => {
    if (file && !busy) {
      setSampleError(null);
      void controller.open(file);
    }
  };

  const openSample = async () => {
    if (busy) return;
    const request = new AbortController();
    sampleRequest.current?.abort();
    sampleRequest.current = request;
    setSampleError(null);
    setSampleLoading(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sample-packet.pdf`, { signal: request.signal });
      if (!response.ok) throw new Error(`Sample request failed (${response.status})`);
      const file = new File([await response.blob()], 'Riverton public works.pdf', { type: 'application/pdf' });
      if (!request.signal.aborted) await controller.open(file);
    } catch {
      if (!request.signal.aborted) setSampleError('Couldn’t load the sample PDF. Please try again.');
    } finally {
      if (!request.signal.aborted) setSampleLoading(false);
    }
  };

  return (
    <main className={`upload-view ${dragging ? 'dragging' : ''}`}>
      <section
        className="upload-controls"
        aria-label="Drop a PDF file"
        aria-busy={busy}
      >
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          aria-label="PDF file"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            open(file);
          }}
        />
        <span className="upload-icon"><FileUp size={30} /></span>
        <h1>Drop a PDF anywhere</h1>
        <button className="button primary" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          {controller.loading ? 'Opening PDF…' : 'Browse for a PDF'}
        </button>
        <div className="sample-option">
          <button className="button secondary sample-button" type="button" onClick={() => void openSample()} disabled={busy}>
            {sampleLoading ? 'Loading sample…' : 'Try a sample PDF'}
          </button>
          <small>30 pages · 8 documents</small>
        </div>
        {sampleError && <p className="sample-error" role="alert">{sampleError}</p>}
        <p className="privacy">Files stay in your browser.</p>
      </section>
    </main>
  );
}
