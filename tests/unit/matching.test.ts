import { describe, expect, it } from 'vitest';
import { matchPages, perceptualHash, similarity } from '../../src/matching';
import type { PageInfo, Signature } from '../../src/types';

function page(number: number, text: string, signature: Signature = Array(256).fill(0)): PageInfo {
  return { number, text, signature, width: 612, height: 792, thumbnail: '' };
}

describe('perceptualHash and similarity', () => {
  it('returns a deterministic 256-bit signature and rejects malformed image data', () => {
    const gray = Uint8Array.from({ length: 64 * 64 }, (_, index) => {
      const x = index % 64;
      const y = Math.floor(index / 64);
      return (x * 3 + y * 5) % 256;
    });

    const first = perceptualHash(gray);
    const second = perceptualHash(gray);

    expect(first).toHaveLength(256);
    expect(first).toEqual(second);
    expect(first.every((bit) => bit === 0 || bit === 1)).toBe(true);
    expect(() => perceptualHash(gray.subarray(0, 4095))).toThrow(/4096|64/i);
  });

  it('reports bounded, symmetric similarity with exact endpoints', () => {
    const black = Array(256).fill(0);
    const white = Array(256).fill(1);
    const oneBitApart = [...black];
    oneBitApart[0] = 1;

    expect(similarity(black, black)).toBe(100);
    expect(similarity(black, white)).toBe(0);
    expect(similarity(black, oneBitApart)).toBe(similarity(oneBitApart, black));
    expect(similarity(black, oneBitApart)).toBeGreaterThan(99);
    expect(similarity(black, oneBitApart)).toBeLessThanOrEqual(100);
  });
});

describe('matchPages text matching', () => {
  const pages = [
    page(1, 'Ｏｆｆｉｃｅ\u00a0of the résumé committee'),
    page(2, 'Routine correspondence'),
    page(3, 'Public administraction memorandum'),
    page(4, 'PUBLIC ADMINISTRATION memorandum'),
    page(5, 'Public administration memorandum'),
  ];

  it('normalizes Unicode compatibility characters, case, and whitespace', () => {
    const result = matchPages({
      pages,
      pageCount: pages.length,
      confirmed: [1],
      rejected: [],
      threshold: 90,
      phrases: [{ text: 'office of the résumé', fuzzy: false }],
      method: 'text',
    });

    expect(result.suggested).not.toContain(1);
    expect(result.pages.find((entry) => entry.page === 1)?.phrase).toBe(true);
    expect(result.pages.find((entry) => entry.page === 2)?.phrase).toBe(false);
  });

  it('allows bounded fuzzy errors only when the phrase opts in', () => {
    const exact = matchPages({
      pages,
      pageCount: pages.length,
      confirmed: [1],
      rejected: [],
      threshold: 90,
      phrases: [{ text: 'public administration', fuzzy: false }],
      method: 'text',
    });
    const fuzzy = matchPages({
      pages,
      pageCount: pages.length,
      confirmed: [1],
      rejected: [5],
      threshold: 90,
      phrases: [{ text: 'public administration', fuzzy: true }],
      method: 'text',
    });

    expect(exact.suggested).not.toContain(3);
    expect(fuzzy.suggested).toContain(3);
    expect(fuzzy.suggested).toContain(4);
    expect(fuzzy.suggested).not.toContain(5);
  });
});

describe('matchPages visual matching', () => {
  it('suggests close visual matches while explicit labels retain authority', () => {
    const black = Array(256).fill(0);
    const oneBitApart = [...black];
    oneBitApart[0] = 1;
    const result = matchPages({
      pages: [
        page(1, 'Confirmed example', black),
        page(2, 'Close candidate', oneBitApart),
        page(3, 'Unrelated candidate', Array(256).fill(1)),
        page(4, 'Rejected close candidate', black),
      ],
      pageCount: 4,
      confirmed: [1],
      rejected: [4],
      threshold: 99,
      phrases: [],
      method: 'visual',
    });

    expect(result.suggested).toContain(2);
    expect(result.suggested).not.toContain(1);
    expect(result.suggested).not.toContain(3);
    expect(result.suggested).not.toContain(4);
    expect(result.pages.find((entry) => entry.page === 2)?.closest).toBe(1);
  });
});
