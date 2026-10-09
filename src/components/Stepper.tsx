import { Check } from 'lucide-react';
import type { SplitterController } from '../types';

const steps = [
  { phase: 'inspect', label: 'Check text' },
  { phase: 'split', label: 'Find starts' },
  { phase: 'export', label: 'Download' },
] as const;

const rank: Record<SplitterController['phase'], number> = { upload: 0, inspect: 1, split: 2, export: 3 };

export function Stepper({ phase }: { phase: SplitterController['phase'] }) {
  const current = rank[phase];
  return (
    <ol className="stepper" aria-label="Progress">
      {steps.map((step, index) => {
        const number = index + 1;
        const done = current > number;
        const active = current === number;
        return (
          <li key={step.phase} className={active ? 'active' : done ? 'done' : ''} aria-current={active ? 'step' : undefined}>
            <span className="step-dot" aria-hidden="true">{done ? <Check size={13} strokeWidth={3} /> : number}</span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
