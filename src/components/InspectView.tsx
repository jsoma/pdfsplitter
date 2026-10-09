import { useMemo, useState } from 'react';
import { RefreshCw, TextSearch } from 'lucide-react';
import { PageImage } from './PagePreview';
import type { SplitterController } from '../types';

function pickSampleNumbers(pageCount: number, seed: number) {
  if (pageCount <= 3) return Array.from({ length: pageCount }, (_, index) => index + 1);
  if (seed === 0) return [1, Math.ceil(pageCount / 2), pageCount];

  const numbers: number[] = [];
  let value = seed * 7919;
  let attempts = 0;
  while (numbers.length < 3 && attempts < pageCount * 3) {
    value = (value * 48271) % 2147483647;
    const number = (value % pageCount) + 1;
    if (!numbers.includes(number)) numbers.push(number);
    attempts += 1;
  }
  for (let number = 1; numbers.length < 3 && number <= pageCount; number += 1) if (!numbers.includes(number)) numbers.push(number);
  return numbers.sort((left, right) => left - right);
}

export function InspectView({ controller }: { controller: SplitterController }) {
  const [seed, setSeed] = useState(0);
  const [selected, setSelected] = useState(1);
  const sampleNumbers = useMemo(() => pickSampleNumbers(controller.pageCount, seed), [controller.pageCount, seed]);
  const samples = useMemo(() => sampleNumbers.map((number) => ({ number, page: controller.pages.find((item) => item.number === number) })), [controller.pages, sampleNumbers]);
  const page = controller.pages.find((item) => item.number === selected);
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
          <button className="text-button" type="button" onClick={() => {
            const nextSeed = seed + 1;
            const nextNumbers = pickSampleNumbers(controller.pageCount, nextSeed);
            setSeed(nextSeed);
            setSelected(nextNumbers[0] ?? 1);
          }}><RefreshCw size={14} /> Refresh sample</button>
        </div>
        <div className="sample-list">
          {samples.map((item) => (
            <button key={item.number} className={item.number === selected ? 'selected' : ''} type="button" onClick={() => setSelected(item.number)} aria-label={`Inspect page ${item.number}`}>
              <PageImage page={item.page} alt="" />
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
