import { useMemo, useState } from 'react';
import { RefreshCw, TextSearch } from 'lucide-react';
import { PageImage } from './PagePreview';
import type { PageInfo, SplitterController } from '../types';

function pickSamples(pages: PageInfo[], seed: number) {
  if (pages.length <= 3) return pages;
  const positions = [0.12, 0.5, 0.86].map((position, index) => {
    const wobble = ((seed * (index + 3) * 17) % 19) / 100 - 0.09;
    return Math.max(0, Math.min(pages.length - 1, Math.round((pages.length - 1) * (position + wobble))));
  });
  return positions.map((position) => pages[position]);
}

export function InspectView({ controller }: { controller: SplitterController }) {
  const [seed, setSeed] = useState(0);
  const [selected, setSelected] = useState(0);
  const samples = useMemo(() => pickSamples(controller.pages, seed), [controller.pages, seed]);
  const page = samples[Math.min(selected, Math.max(0, samples.length - 1))];
  const textCount = controller.pages.filter((item) => item.text.trim()).length;

  return (
    <main className="inspect-view">
      <aside className="inspect-sidebar">
        <div className="section-heading"><TextSearch size={19} /><div><h2>Check the text</h2><p>We use text already embedded in the PDF. No OCR is run.</p></div></div>
        <div className="text-availability">
          <span>Text available</span>
          <strong>{textCount} of {controller.pageCount} pages</strong>
          <div className="availability-track"><i style={{ width: `${controller.pageCount ? (textCount / controller.pageCount) * 100 : 0}%` }} /></div>
        </div>
        <div className="sample-heading">
          <h3>Sample pages</h3>
          <button className="text-button" type="button" onClick={() => { setSeed((value) => value + 1); setSelected(0); }}><RefreshCw size={14} /> Refresh sample</button>
        </div>
        <div className="sample-list">
          {samples.map((item, index) => (
            <button key={`${item.number}-${index}`} className={item.number === page?.number ? 'selected' : ''} type="button" onClick={() => setSelected(index)} aria-label={`Inspect page ${item.number}`}>
              <PageImage page={item} alt="" />
              <span>Page {item.number}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="inspect-detail">
        {page ? (
          <>
            <div className="detail-heading"><span>Page {page.number}</span><span className={`status-chip ${page.text.trim() ? 'good' : 'quiet'}`}>{page.text.trim() ? 'Text available' : 'No text found'}</span></div>
            <div className="inspection-pair">
              <div className="document-preview"><PageImage page={page} alt={`Page ${page.number} preview`} /></div>
              <div className="text-preview">
                <span>Text read from this page</span>
                <pre>{page.text.trim() || 'No embedded text was found on this page. Visual matching can still help find document starts.'}</pre>
              </div>
            </div>
          </>
        ) : (
          <div className="preparing-state"><span className="spinner" />Preparing page previews…</div>
        )}
      </section>
    </main>
  );
}
