import { ArrowLeft, ArrowRight, RotateCcw, Undo2 } from 'lucide-react';
import { ExportView } from './components/ExportView';
import { InspectView } from './components/InspectView';
import { SplitView } from './components/SplitView';
import { Stepper } from './components/Stepper';
import { UploadView } from './components/UploadView';
import { useSplitter } from './useSplitter';

export default function App() {
  const controller = useSplitter();
  const hasMeaningfulWork = controller.confirmed.some((page) => page !== 1) || controller.rejected.length > 0 || controller.phrases.length > 0 || controller.phase === 'export';
  const startOver = () => {
    if (!hasMeaningfulWork || window.confirm('Start over? Your document-start decisions and filenames will be cleared.')) controller.reset();
  };

  return (
    <div className={`app phase-${controller.phase}`}>
      <header className="app-header">
        <a className="brand" href="./" onClick={(event) => { event.preventDefault(); startOver(); }} aria-label="PDF Splitter home"><span>PS</span><strong>PDF Splitter</strong></a>
        {controller.phase !== 'upload' && <Stepper phase={controller.phase} />}
        {controller.phase !== 'upload' && <button className="start-over" type="button" onClick={startOver}><RotateCcw size={15} /> Start over</button>}
      </header>

      {controller.phase !== 'upload' && (
        <div className="file-bar">
          <span className="file-name">{controller.filename}</span><span>{controller.pageCount} pages</span>
          {controller.progress && !controller.exporting && <span className="inline-loading" role="status"><i className="spinner" />{controller.progress.label} {controller.progress.completed} of {controller.progress.total}</span>}
        </div>
      )}

      {controller.error && <div className="error-banner" role="alert">{controller.error}</div>}
      {controller.phase === 'upload' && <UploadView controller={controller} />}
      {controller.phase === 'inspect' && <InspectView controller={controller} />}
      {controller.phase === 'split' && <SplitView controller={controller} />}
      {controller.phase === 'export' && <ExportView controller={controller} />}

      {controller.phase !== 'upload' && (
        <footer className="app-footer">
          <div>
            {controller.phase === 'inspect' && <button className="button secondary" type="button" onClick={startOver}><ArrowLeft size={16} /> Choose another PDF</button>}
            {controller.phase === 'split' && <button className="button secondary" type="button" onClick={() => controller.setPhase('inspect')}><ArrowLeft size={16} /> Check text</button>}
            {controller.phase === 'export' && <button className="button secondary" type="button" onClick={() => controller.setPhase('split')}><ArrowLeft size={16} /> Find starts</button>}
            {controller.phase === 'split' && controller.canUndo && <button className="text-button footer-undo" type="button" onClick={() => controller.undo()}><Undo2 size={15} /> Undo</button>}
          </div>
          <div className="footer-status">
            {controller.phase === 'inspect' && <span>You can continue while remaining pages prepare.</span>}
            {controller.phase === 'split' && <span>{controller.confirmed.length} marked · {controller.matches.suggested.length} suggested · {controller.matches.unsure.length} unsure</span>}
            {controller.phase === 'export' && <span>{controller.documents.length} documents · {controller.pageCount} pages</span>}
          </div>
          <div>
            {controller.phase === 'inspect' && <button className="button primary" type="button" onClick={() => controller.setPhase('split')}>Continue to find starts <ArrowRight size={16} /></button>}
            {controller.phase === 'split' && <>{controller.matches.suggested.length > 0 && <button className="button secondary" type="button" onClick={() => controller.acceptAll()}>Accept all {controller.matches.suggested.length} suggestions</button>}<button className="button primary" type="button" onClick={() => controller.setPhase('export')}>Continue to download <ArrowRight size={16} /></button></>}
          </div>
        </footer>
      )}
    </div>
  );
}
