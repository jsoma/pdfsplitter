import { describe, expect, it } from 'vitest';
import { splitRanges } from '../../src/matching';

describe('splitRanges', () => {
  it('sorts and deduplicates starts into exhaustive 1-based inclusive ranges', () => {
    const documents = splitRanges(6, [6, 3, 3], 'records.pdf');

    expect(documents.map(({ start, end }) => [start, end])).toEqual([
      [1, 2],
      [3, 5],
      [6, 6],
    ]);
    expect(documents.every(({ filename }) => filename.endsWith('.pdf'))).toBe(true);
    expect(new Set(documents.map(({ filename }) => filename)).size).toBe(documents.length);
  });

  it('always includes page 1 even when it is not supplied as a start', () => {
    expect(splitRanges(3, [2], 'case.pdf').map(({ start, end }) => [start, end])).toEqual([
      [1, 1],
      [2, 3],
    ]);
  });

  it('rejects invalid page counts and start pages', () => {
    expect(() => splitRanges(0, [], 'case.pdf')).toThrow(RangeError);
    expect(() => splitRanges(3, [0], 'case.pdf')).toThrow(RangeError);
    expect(() => splitRanges(3, [4], 'case.pdf')).toThrow(RangeError);
    expect(() => splitRanges(3, [1.5], 'case.pdf')).toThrow(RangeError);
  });
});
