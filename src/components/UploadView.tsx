import { useEffect, useRef, useState } from 'react';
import { FileUp, LockKeyhole } from 'lucide-react';
import type { SplitterController } from '../types';

export function UploadView({ controller }: { controller: SplitterController }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sampleRequest = useRef<AbortController | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const busy = controller.loading || sampleLoading;

  useEffect(() => () => sampleRequest.current?.abort(), []);

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
    <main className="upload-view">
      <section className="upload-intro">
        <p className="eyebrow">LOCAL PDF TOOL</p>
        <h1>Turn one PDF packet into separate documents.</h1>
        <p className="lede">Check the text, find each first page, then download clean PDFs in one ZIP.</p>
        <div className="workflow-preview" aria-label="Three step workflow">
          <span><b>1</b> Check text</span><i />
          <span><b>2</b> Find starts</span><i />
          <span><b>3</b> Download</span>
        </div>
      </section>

      <section
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) open(event.dataTransfer.files[0]); }}
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
        <h2>Drop a PDF here</h2>
        <p>or choose one from your device</p>
        <button className="button primary" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          {controller.loading ? 'Opening PDF…' : 'Browse for a PDF'}
        </button>
        <div className="sample-option">
          <span className="sample-divider">or</span>
          <button className="button secondary sample-button" type="button" onClick={() => void openSample()} disabled={busy}>
            {sampleLoading ? 'Loading sample…' : 'Try a sample PDF'}
          </button>
          <small>30 pages · 8 documents</small>
        </div>
        {sampleError && <p className="sample-error" role="alert">{sampleError}</p>}
        <p className="privacy"><LockKeyhole size={15} /> Files stay in your browser</p>
      </section>
    </main>
  );
}
