export type Signature = number[];
export interface PageInfo { number: number; width: number; height: number; text: string; thumbnail: string; signature: Signature; }
export type Method = 'visual' | 'text' | 'manual';
export type PageLabel = 'start' | 'not-start' | 'clear';
export interface PhraseRule { text: string; fuzzy: boolean; }
export interface PageMatch { page: number; score: number | null; closest: number | null; kind: number | null; phrase: boolean; suggested: boolean; }
export interface MatchResult { pages: PageMatch[]; suggested: number[]; unsure: number[]; kinds: number[][]; }
export interface OutputDocument { start: number; end: number; filename: string; }
export interface Progress { completed: number; total: number; label: string; }
export interface UndoResult { page: number; confirmed: number[]; rejected: number[]; }
export interface SplitterController {
 phase: 'upload' | 'inspect' | 'split' | 'export'; filename: string; pageCount: number; pages: PageInfo[];
 progress: Progress | null; error: string | null; loading: boolean; exporting: boolean;
 confirmed: number[]; rejected: number[]; method: Method; threshold: number; phrases: PhraseRule[]; matches: MatchResult; documents: OutputDocument[];
 open(file: File): Promise<void>; reset(): void; setPhase(phase: 'inspect' | 'split' | 'export'): void;
 setMethod(method: Method): void; setThreshold(value: number): void; setPhrases(phrases: PhraseRule[]): void;
 label(page: number, label: PageLabel): void; acceptAll(): void; undo(): UndoResult | null; canUndo: boolean;
 filenameTemplate: string; setFilenameTemplate(value: string): void; previewDocument(document: OutputDocument): void; download(): Promise<void>; cancelExport(): void;
 render(page: number, canvas: HTMLCanvasElement, width: number, signal?: AbortSignal): Promise<void>;
}
