import { describe, expect, it } from 'vitest';
import { splitRanges } from '../../src/matching';

describe('splitRanges', () => {
  it('turns unsorted, repeated starts into exhaustive 1-based inclusive ranges', () => {
    const documents = splitRanges(6, [6, 3, 3], 'records.pdf');

    expect(documents.map(({ start, end }) => [start, end])).toEqual([
      [1, 2],
      [3, 5],
      [6, 6],
    ]);
    expect(documents.every(({ filename }) => filename.endsWith('.pdf'))).toBe(true);
    expect(new Set(documents.map(({ filename }) => filename)).size).toBe(documents.length);
  });

  it('always keeps page 1 and ignores starts outside the document', () => {
    expect(splitRanges(3, [-1, 0, 2, 4, 999], 'case').map(({ start, end }) => [start, end])).toEqual([
      [1, 1],
      [2, 3],
    ]);
  });

  it('generates safe filenames from hostile or empty basenames', () => {
    for (const basename of ['../../secret.pdf', '..\\..\\secret.pdf', '', '.pdf']) {
      const documents = splitRanges(4, [1, 2, 3], basename);
      for (const { filename } of documents) {
        expect(filename).toMatch(/\.pdf$/i);
        expect(filename).not.toMatch(/[\\/]/);
        expect(filename).not.toContain('..');
        expect(filename.replace(/\.pdf$/i, '')).not.toHaveLength(0);
      }
      expect(new Set(documents.map(({ filename }) => filename)).size).toBe(documents.length);
    }
  });

  it('returns no documents for an empty source', () => {
    expect(splitRanges(0, [1], 'empty.pdf')).toEqual([]);
  });
});
