import { Archive, Download, FileText } from 'lucide-react';
import type { SplitterController } from '../types';

export function ExportView({ controller }: { controller: SplitterController }) {
  const totalPages = controller.documents.reduce((total, document) => total + document.end - document.start + 1, 0);
  return (
    <main className="export-view">
      <section className="export-heading">
        <div className="export-icon"><Archive size={25} /></div>
        <div><h1>{controller.documents.length} documents ready</h1><p>Review the page ranges and filenames. Your original PDF stays unchanged.</p></div>
      </section>
      <section className="document-list" aria-label="Output documents">
        <header><span>Document</span><span>Pages</span><span>Filename</span></header>
        {controller.documents.map((document, index) => {
          const first = controller.pages.find((page) => page.number === document.start);
          const count = document.end - document.start + 1;
          return (
            <article key={document.start}>
              <span className="doc-index"><FileText size={17} />{String(index + 1).padStart(2, '0')}</span>
              <span className="doc-range">{document.start}–{document.end}<small>{count} {count === 1 ? 'page' : 'pages'}</small></span>
              <label><span className="visually-hidden">Filename for document starting page {document.start}</span><input disabled={controller.exporting} value={document.filename} onChange={(event) => controller.rename(document.start, event.target.value)} /></label>
              <p>{first?.text.trim().slice(0, 130) || `Starts at page ${document.start}`}</p>
            </article>
          );
        })}
      </section>
      <div className="export-summary"><span>{controller.documents.length} PDFs</span><span>{totalPages} pages</span><span>One ZIP download</span></div>
      <button className="button primary download-button" type="button" onClick={() => void controller.download()} disabled={controller.exporting || controller.documents.length === 0}><Download size={18} />Download all as ZIP</button>
      {controller.exporting && (
        <section className="export-progress" role="status" aria-live="polite">
          <div><strong>{controller.progress?.label || 'Building your ZIP…'}</strong><span>{controller.progress ? `${controller.progress.completed} of ${controller.progress.total}` : ''}</span></div>
          <div className="progress-track"><i style={{ width: controller.progress?.total ? `${(controller.progress.completed / controller.progress.total) * 100}%` : '8%' }} /></div>
          <button className="text-button" type="button" onClick={() => controller.cancelExport()}>Cancel export</button>
        </section>
      )}
    </main>
  );
}
