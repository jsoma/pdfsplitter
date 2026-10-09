import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Method, SplitterController } from '../types';

export function MethodPanel({ controller }: { controller: SplitterController }) {
  const [phrase, setPhrase] = useState('');
  const [fuzzy, setFuzzy] = useState(false);
  const setMethod = (method: Method) => controller.setMethod(method);
  const addPhrase = () => {
    const text = phrase.trim();
    if (!text) return;
    controller.setPhrases([...controller.phrases, { text, fuzzy }]);
    setPhrase('');
  };

  return (
    <section className="method-panel">
      <div className="segmented" role="tablist" aria-label="Matching method">
        {(['visual', 'text', 'manual'] as Method[]).map((method) => (
          <button key={method} type="button" role="tab" aria-selected={controller.method === method} onClick={() => setMethod(method)}>
            {method[0].toUpperCase() + method.slice(1)}
          </button>
        ))}
      </div>

      {controller.method === 'visual' && (
        <div className="method-settings">
          <label className="slider-label" htmlFor="similarity"><span>How similar</span><strong>{controller.threshold}%</strong></label>
          <input id="similarity" type="range" min="50" max="100" value={controller.threshold} onChange={(event) => controller.setThreshold(Number(event.target.value))} />
          <p>Based on {controller.confirmed.length} marked {controller.confirmed.length === 1 ? 'start' : 'starts'} and {controller.rejected.length} rejected pages. Click a page to mark another start.</p>
        </div>
      )}

      {controller.method === 'text' && (
        <div className="method-settings phrase-settings">
          <label htmlFor="phrase-rule">Start phrase</label>
          <div className="phrase-entry">
            <input id="phrase-rule" value={phrase} placeholder="e.g. memorandum for" onChange={(event) => setPhrase(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addPhrase(); }} />
            <button type="button" className="icon-button" onClick={addPhrase} aria-label="Add phrase"><Plus size={17} /></button>
          </div>
          <label className="check-row"><input type="checkbox" checked={fuzzy} onChange={(event) => setFuzzy(event.target.checked)} /> Allow close matches</label>
          <div className="phrase-list">
            {controller.phrases.map((rule, index) => (
              <div key={`${rule.text}-${index}`}><span>{rule.text}</span><em>{rule.fuzzy ? 'Close match' : 'Literal'}</em><button type="button" onClick={() => controller.setPhrases(controller.phrases.filter((_, item) => item !== index))} aria-label={`Remove text rule ${rule.text}`}><Trash2 size={14} /></button></div>
            ))}
          </div>
        </div>
      )}

      {controller.method === 'manual' && (
        <div className="method-settings manual-note"><p>Click any page in the grid to mark or remove a document start.</p></div>
      )}
    </section>
  );
}
