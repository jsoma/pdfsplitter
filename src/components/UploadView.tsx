import { useRef, useState } from 'react';
import { FileUp, LockKeyhole } from 'lucide-react';
import type { SplitterController } from '../types';

export function UploadView({ controller }: { controller: SplitterController }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const open = (file?: File) => {
    if (file) void controller.open(file);
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
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); open(event.dataTransfer.files[0]); }}
        aria-label="Drop a PDF file"
      >
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          aria-label="PDF file"
          onChange={(event) => open(event.currentTarget.files?.[0])}
        />
        <span className="upload-icon"><FileUp size={30} /></span>
        <h2>Drop a PDF here</h2>
        <p>or choose one from your device</p>
        <button className="button primary" type="button" onClick={() => inputRef.current?.click()} disabled={controller.loading}>
          {controller.loading ? 'Opening PDF…' : 'Browse for a PDF'}
        </button>
        <p className="privacy"><LockKeyhole size={15} /> Files stay in your browser</p>
      </section>
    </main>
  );
}
