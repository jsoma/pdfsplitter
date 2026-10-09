import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { RenderedPage } from './PagePreview';
import type { PageMatch, SplitterController } from '../types';

function statusFor(controller: SplitterController, page: number, match?: PageMatch) {
  if (controller.confirmed.includes(page)) return { label: 'Start of a document', tone: 'confirmed' };
  if (controller.rejected.includes(page)) return { label: 'Marked not a start', tone: 'neutral' };
  if (controller.matches.suggested.includes(page)) return { label: `Suggested start${match?.score == null ? '' : ` · ${Math.round(match.score)}%`}`, tone: 'suggested' };
  if (controller.matches.unsure.includes(page)) return { label: `Unsure${match?.score == null ? '' : ` · ${Math.round(match.score)}%`}`, tone: 'unsure' };
  return { label: 'Continuation page', tone: 'neutral' };
}

export function LargePageView({ controller, page, onChange, onClose }: { controller: SplitterController; page: number; onChange: (page: number) => void; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const match = controller.matches.pages.find((item) => item.page === page);
  const status = statusFor(controller, page, match);
  const confirmed = controller.confirmed.includes(page);
  const candidate = controller.matches.suggested.includes(page) || controller.matches.unsure.includes(page);

  useEffect(() => {
    restoreFocus.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    return () => restoreFocus.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') onChange(Math.max(1, page - 1));
      else if (event.key === 'ArrowRight') onChange(Math.min(controller.pageCount, page + 1));
      else if (event.key.toLowerCase() === 's' && !confirmed) controller.label(page, 'start');
      else if (event.key.toLowerCase() === 'x' && page !== 1 && (confirmed || candidate)) controller.label(page, confirmed ? 'clear' : 'not-start');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [candidate, confirmed, controller, onChange, onClose, page]);

  return (
    <div className="large-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="large-dialog" role="dialog" aria-modal="true" aria-labelledby="large-title">
        <header><div><h2 id="large-title">Page {page}</h2><span className={`status-pill ${status.tone}`}>{status.label}</span></div><button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close large page view"><X size={20} /></button></header>
        <div className="large-body">
          <button type="button" className="page-arrow" onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous page"><ChevronLeft /></button>
          {page > 1 && <div className="previous-render"><RenderedPage controller={controller} page={page - 1} width={150} label={`Page ${page - 1} before`} /><span>p {page - 1} · before</span></div>}
          <div className={`current-render ${status.tone}`}><RenderedPage controller={controller} page={page} width={390} label={`Page ${page}`} /><strong>Page {page}</strong></div>
          <button type="button" className="page-arrow" onClick={() => onChange(Math.min(controller.pageCount, page + 1))} disabled={page === controller.pageCount} aria-label="Next page"><ChevronRight /></button>
        </div>
        <footer>
          <div className="large-actions">
            {!confirmed && <button className="button dark" type="button" onClick={() => controller.label(page, 'start')}>Starts a document <kbd>S</kbd></button>}
            {page !== 1 && (confirmed || candidate) && <button className="button secondary" type="button" onClick={() => controller.label(page, confirmed ? 'clear' : 'not-start')}>{confirmed ? 'Remove start' : 'Not a start'} <kbd>X</kbd></button>}
          </div>
          <span>← → pages · Esc close</span>
        </footer>
      </section>
    </div>
  );
}
