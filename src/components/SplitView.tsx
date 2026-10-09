import { Check, ChevronLeft, ChevronRight, Expand, Minus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LargePageView } from './LargePageView';
import { MethodPanel } from './MethodPanel';
import { PageImage } from './PagePreview';
import type { PageInfo, PageMatch, SplitterController } from '../types';

type ReviewTab = 'unsure' | 'suggested';
const sizes = [56, 72, 96, 126];

function PageTile({ controller, page, match, size, onLarge }: { controller: SplitterController; page: PageInfo; match?: PageMatch; size: number; onLarge: () => void }) {
  const confirmed = controller.confirmed.includes(page.number);
  const suggested = controller.matches.suggested.includes(page.number);
  const unsure = controller.matches.unsure.includes(page.number);
  const rejected = controller.rejected.includes(page.number);
  const status = confirmed ? 'confirmed' : suggested ? 'suggested' : unsure ? 'unsure' : rejected ? 'rejected' : '';

  const toggle = () => {
    if (page.number === 1) return;
    controller.label(page.number, confirmed ? 'clear' : 'start');
  };

  return (
    <article className={`page-tile ${status}`} style={{ '--page-width': `${size}px` } as React.CSSProperties}>
      <button type="button" className="page-target" onClick={toggle} aria-label={`Page ${page.number}${confirmed ? ', document start' : ''}`} aria-pressed={confirmed}>
        <PageImage page={page} alt="" />
      </button>
      <div className="tile-actions">
        <button type="button" onClick={onLarge} aria-label={`View page ${page.number} large`} title="View large"><Expand size={13} /></button>
        {size > sizes[0] && !confirmed && <button type="button" className="mark" onClick={() => controller.label(page.number, 'start')} aria-label={`Mark page ${page.number} as start`} title="Mark as start"><Check size={14} /></button>}
        {size > sizes[0] && page.number !== 1 && (confirmed || suggested || unsure) && <button type="button" onClick={() => controller.label(page.number, confirmed ? 'clear' : 'not-start')} aria-label={confirmed ? `Remove page ${page.number} as start` : `Mark page ${page.number} as not a start`} title={confirmed ? 'Remove start' : 'Not a start'}><X size={14} /></button>}
      </div>
      <span className="page-number">{page.number}</span>
      {confirmed && <span className="page-tag confirmed">Start</span>}
      {!confirmed && suggested && <span className="page-tag suggested">{match?.score == null ? 'suggested' : `${Math.round(match.score)}%`}</span>}
      {!confirmed && unsure && <span className="page-tag unsure">unsure</span>}
    </article>
  );
}

function MiniMap({ controller }: { controller: SplitterController }) {
  return (
    <aside className="minimap" aria-label="Packet overview">
      <div className="minimap-grid">
        {controller.pages.map((page) => {
          const tone = controller.confirmed.includes(page.number) ? 'confirmed' : controller.matches.suggested.includes(page.number) ? 'suggested' : controller.matches.unsure.includes(page.number) ? 'unsure' : '';
          return <i key={page.number} className={tone} />;
        })}
      </div>
      <span>1–{controller.pages.length} of {controller.pageCount}</span>
    </aside>
  );
}

function ReviewCard({ controller, onLarge, shortcutsActive }: { controller: SplitterController; onLarge: (page: number) => void; shortcutsActive: boolean }) {
  const [tab, setTab] = useState<ReviewTab>('unsure');
  const [index, setIndex] = useState(0);
  const queue = tab === 'unsure' ? controller.matches.unsure : controller.matches.suggested;
  const safeIndex = Math.min(index, Math.max(0, queue.length - 1));
  const candidate = queue[safeIndex];
  const page = controller.pages.find((item) => item.number === candidate);
  const before = controller.pages.find((item) => item.number === candidate - 1);
  const match = controller.matches.pages.find((item) => item.page === candidate);

  useEffect(() => {
    setIndex((value) => Math.min(value, Math.max(0, queue.length - 1)));
  }, [queue.length]);

  useEffect(() => {
    if (!shortcutsActive) return;
    const handleKey = (event: KeyboardEvent) => {
      if (!candidate || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key.toLowerCase() === 'y') controller.label(candidate, 'start');
      else if (event.key.toLowerCase() === 'n') controller.label(candidate, 'not-start');
      else if (event.key === '[') setIndex((value) => Math.max(0, value - 1));
      else if (event.key === ']') setIndex((value) => Math.min(queue.length - 1, value + 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [candidate, controller, queue.length, shortcutsActive]);

  return (
    <section className={`review-card ${tab}`}>
      <div className="segmented review-tabs" role="tablist" aria-label="Review queue">
        <button type="button" role="tab" aria-selected={tab === 'unsure'} onClick={() => { setTab('unsure'); setIndex(0); }}>Unsure <b>{controller.matches.unsure.length}</b></button>
        <button type="button" role="tab" aria-selected={tab === 'suggested'} onClick={() => { setTab('suggested'); setIndex(0); }}>Suggested <b>{controller.matches.suggested.length}</b></button>
      </div>
      {candidate && page ? (
        <>
          <div className="review-title"><strong>{tab === 'unsure' ? 'Does a document start here?' : 'Likely a start'}</strong><span>{safeIndex + 1} of {queue.length}</span></div>
          <div className="review-pages">
            {before && <div className="review-before"><PageImage page={before} alt={`Page ${before.number}, before`} /><span>p {before.number} · before</span></div>}
            <button type="button" className="review-candidate" onClick={() => onLarge(candidate)} aria-label={`View page ${candidate} large`}><PageImage page={page} alt="" /><span>Page {candidate}{match?.score == null ? '' : ` · ${Math.round(match.score)}% similar`}</span></button>
          </div>
          <div className="review-actions">
            <button className="icon-button" type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={safeIndex === 0} aria-label="Previous review page"><ChevronLeft /></button>
            <button className="button dark" type="button" onClick={() => controller.label(candidate, 'start')}>{tab === 'unsure' ? 'Yes, starts here' : 'Accept'}</button>
            <button className="button secondary" type="button" onClick={() => controller.label(candidate, 'not-start')}>{tab === 'unsure' ? 'No' : 'Not a start'}</button>
            <button className="icon-button" type="button" onClick={() => setIndex((value) => Math.min(queue.length - 1, value + 1))} disabled={safeIndex === queue.length - 1} aria-label="Skip to next review page"><ChevronRight /></button>
          </div>
          {tab === 'suggested' && <button className="accept-link" type="button" onClick={() => controller.acceptAll()}>Accept all {controller.matches.suggested.length} suggestions</button>}
        </>
      ) : <div className="empty-queue">No {tab} pages left.</div>}
    </section>
  );
}

export function SplitView({ controller }: { controller: SplitterController }) {
  const [gridSize, setGridSize] = useState(1);
  const [filter, setFilter] = useState<'all' | 'starts'>('all');
  const [largePage, setLargePage] = useState<number | null>(null);
  const shownPages = useMemo(() => {
    if (filter === 'all') return controller.pages;
    const candidatePages = new Set([...controller.confirmed, ...controller.matches.suggested, ...controller.matches.unsure]);
    return controller.pages.filter((page) => candidatePages.has(page.number));
  }, [controller.confirmed, controller.matches.suggested, controller.matches.unsure, controller.pages, filter]);
  const matches = useMemo(() => new Map(controller.matches.pages.map((match) => [match.page, match])), [controller.matches.pages]);

  return (
    <main className="split-view">
      <section className="packet-panel">
        <div className="grid-toolbar">
          <div className="legend" aria-label="Page legend"><span className="confirmed"><i />Marked</span><span className="suggested"><i />Suggested</span><span className="unsure"><i />Unsure</span></div>
          <div className="filter-tabs"><button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All pages {controller.pageCount}</button><button type="button" className={filter === 'starts' ? 'active' : ''} onClick={() => setFilter('starts')}>Starts only {controller.confirmed.length + controller.matches.suggested.length + controller.matches.unsure.length}</button></div>
          <div className="zoom-control"><button type="button" onClick={() => setGridSize((value) => Math.max(0, value - 1))} disabled={gridSize === 0} aria-label="Smaller pages"><Minus size={14} /></button><input type="range" min="0" max="3" step="1" value={gridSize} onChange={(event) => setGridSize(Number(event.target.value))} aria-label="Page grid size" /><button type="button" onClick={() => setGridSize((value) => Math.min(3, value + 1))} disabled={gridSize === 3} aria-label="Larger pages"><Plus size={14} /></button></div>
        </div>
        <div className="grid-area">
          <div className="page-grid" style={{ '--page-width': `${sizes[gridSize]}px` } as React.CSSProperties}>
            {shownPages.map((page) => <PageTile key={page.number} controller={controller} page={page} match={matches.get(page.number)} size={sizes[gridSize]} onLarge={() => setLargePage(page.number)} />)}
            {controller.pages.length < controller.pageCount && <div className="grid-preparing"><span className="spinner" /> Preparing {controller.pageCount - controller.pages.length} more pages…</div>}
          </div>
          <MiniMap controller={controller} />
        </div>
      </section>
      <aside className="split-sidebar"><MethodPanel controller={controller} /><ReviewCard controller={controller} onLarge={setLargePage} shortcutsActive={largePage == null} /></aside>
      {largePage != null && <LargePageView controller={controller} page={largePage} onChange={setLargePage} onClose={() => setLargePage(null)} />}
    </main>
  );
}
