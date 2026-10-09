import { Download } from 'lucide-react';
import type { SplitterController } from '../types';
import { PageImage } from './PagePreview';
import './ExportView.css';

export function ExportView({ controller }: { controller: SplitterController }) {
  const firstFilename = controller.documents[0]?.filename;
  const progress = controller.progress;

  return (
    <main className="export-workspace">
      <section className="export-command" aria-label="Export controls">
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

      </section>

      <section className="export-documents" aria-labelledby="export-documents-title">
        <div className="export-documents__heading">
          <h1 id="export-documents-title">{controller.documents.length} documents</h1>
          <span>First page of each document</span>
        </div>
        <div className="export-document-grid">
          {controller.documents.map((document, index) => {
            const firstPage = controller.pages.find((page) => page.number === document.start);
            const count = document.end - document.start + 1;
            return (
              <button
                className="export-document-card"
                key={document.start}
                type="button"
                onClick={() => controller.previewDocument(document)}
                aria-label={`Open document ${index + 1} as PDF`}
                title="Open PDF in a new tab"
              >
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
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
