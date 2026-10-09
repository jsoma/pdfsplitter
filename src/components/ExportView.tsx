import { Archive, Download } from 'lucide-react';
import type { SplitterController } from '../types';
import { PageImage } from './PagePreview';
import './ExportView.css';

export function ExportView({ controller }: { controller: SplitterController }) {
  const totalPages = controller.documents.reduce(
    (total, document) => total + document.end - document.start + 1,
    0,
  );
  const firstFilename = controller.documents[0]?.filename;
  const progress = controller.progress;

  return (
    <main className="export-workspace">
      <section className="export-command" aria-labelledby="export-title">
        <div className="export-command__title">
          <span className="export-command__icon" aria-hidden="true"><Archive size={25} /></span>
          <div>
            <h1 id="export-title">{controller.documents.length} documents ready</h1>
            <p>{controller.documents.length} PDFs · {totalPages} pages · one ZIP</p>
          </div>
        </div>

        <div className="export-template">
          <label htmlFor="filename-template">Filename template</label>
          <input
            id="filename-template"
            value={controller.filenameTemplate}
            onChange={(event) => controller.setFilenameTemplate(event.target.value)}
            disabled={controller.exporting}
            aria-describedby="filename-template-help"
            spellCheck={false}
          />
          <div id="filename-template-help" className="export-template__help">
            <span>Use {'{name}'}, {'{index}'}, {'{start}'}, and {'{end}'}</span>
            {firstFilename && <span className="export-template__example">Example: {firstFilename}</span>}
          </div>
        </div>

        <div className="export-action">
          <button
            className="button primary export-download"
            type="button"
            onClick={() => void controller.download()}
            disabled={controller.exporting || controller.documents.length === 0}
          >
            <Download size={22} />
            Download all as ZIP
          </button>

          {controller.exporting && (
            <div className="export-action__progress" role="status" aria-live="polite">
              <div>
                <strong>{progress?.label || 'Building your ZIP…'}</strong>
                <span>{progress ? `${progress.completed} of ${progress.total}` : ''}</span>
              </div>
              <div className="export-action__track" aria-hidden="true">
                <i style={{ width: progress?.total ? `${(progress.completed / progress.total) * 100}%` : '8%' }} />
              </div>
              <button className="text-button" type="button" onClick={() => controller.cancelExport()}>
                Cancel export
              </button>
            </div>
          )}
        </div>

        <p className="export-command__note">Your original PDF stays unchanged.</p>
      </section>

      <section className="export-documents" aria-labelledby="export-documents-title">
        <div className="export-documents__heading">
          <h2 id="export-documents-title">Documents in your ZIP</h2>
          <span>First page of each document</span>
        </div>
        <div className="export-document-grid" role="list">
          {controller.documents.map((document, index) => {
            const firstPage = controller.pages.find((page) => page.number === document.start);
            const count = document.end - document.start + 1;
            return (
              <article className="export-document-card" key={document.start} role="listitem">
                <div className="export-document-card__preview">
                  <PageImage
                    page={firstPage}
                    alt={`First page of document ${index + 1}, page ${document.start}`}
                  />
                  <span>Page {document.start}</span>
                </div>
                <div className="export-document-card__meta">
                  <span>Document {String(index + 1).padStart(2, '0')}</span>
                  <strong>{count} {count === 1 ? 'page' : 'pages'}</strong>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
