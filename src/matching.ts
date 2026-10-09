import type {
  MatchResult,
  Method,
  OutputDocument,
  PageInfo,
  PhraseRule,
  Signature,
} from './types';

const DCT_SIZE = 64;
const LOW_FREQUENCY_SIZE = 16;
const SIGNATURE_BITS = LOW_FREQUENCY_SIZE * LOW_FREQUENCY_SIZE;
const KIND_SIMILARITY = 75;
const UNSURE_BAND = 20;

let dctBasis: number[][] | undefined;

function basis(): number[][] {
  if (dctBasis) return dctBasis;

  dctBasis = Array.from({ length: LOW_FREQUENCY_SIZE }, (_, frequency) => {
    const scale = frequency === 0
      ? Math.sqrt(1 / DCT_SIZE)
      : Math.sqrt(2 / DCT_SIZE);
    return Array.from(
      { length: DCT_SIZE },
      (_, sample) => scale * Math.cos(
        (Math.PI * (2 * sample + 1) * frequency) / (2 * DCT_SIZE),
      ),
    );
  });
  return dctBasis;
}

function checkedSignature(value: ArrayLike<number>, label: string): Signature {
  if (value == null || value.length !== SIGNATURE_BITS) {
    throw new RangeError(`${label} must contain exactly ${SIGNATURE_BITS} bits`);
  }

  return Array.from(value, (bit) => {
    if (bit !== 0 && bit !== 1) {
      throw new TypeError(`${label} must contain only zeroes and ones`);
    }
    return bit;
  });
}

/** Build a 256-bit perceptual signature from a row-major 64 x 64 gray image. */
export function perceptualHash(gray: ArrayLike<number>): Signature {
  if (gray == null || gray.length !== DCT_SIZE * DCT_SIZE) {
    throw new RangeError('gray must contain exactly 4096 samples for a 64 x 64 image');
  }

  const transform = basis();
  const horizontal = new Float64Array(DCT_SIZE * LOW_FREQUENCY_SIZE);

  for (let row = 0; row < DCT_SIZE; row += 1) {
    const inputOffset = row * DCT_SIZE;
    const outputOffset = row * LOW_FREQUENCY_SIZE;
    for (let frequency = 0; frequency < LOW_FREQUENCY_SIZE; frequency += 1) {
      let coefficient = 0;
      const weights = transform[frequency];
      for (let column = 0; column < DCT_SIZE; column += 1) {
        const sample = gray[inputOffset + column];
        if (typeof sample !== 'number' || !Number.isFinite(sample)) {
          throw new TypeError('gray samples must be finite numbers');
        }
        coefficient += sample * weights[column];
      }
      horizontal[outputOffset + frequency] = coefficient;
    }
  }

  const coefficients = new Array<number>(SIGNATURE_BITS);
  for (let vertical = 0; vertical < LOW_FREQUENCY_SIZE; vertical += 1) {
    const weights = transform[vertical];
    for (let horizontalFrequency = 0;
      horizontalFrequency < LOW_FREQUENCY_SIZE;
      horizontalFrequency += 1) {
      let coefficient = 0;
      for (let row = 0; row < DCT_SIZE; row += 1) {
        coefficient += weights[row]
          * horizontal[row * LOW_FREQUENCY_SIZE + horizontalFrequency];
      }
      coefficients[vertical * LOW_FREQUENCY_SIZE + horizontalFrequency] = coefficient;
    }
  }

  const ordered = [...coefficients].sort((left, right) => left - right);
  const median = (ordered[SIGNATURE_BITS / 2 - 1] + ordered[SIGNATURE_BITS / 2]) / 2;
  return coefficients.map((coefficient) => Number(coefficient > median));
}

/** Return normalized Hamming similarity on the same 0..100 scale as the UI. */
function hammingSimilarity(left: Signature, right: Signature): number {
  let equal = 0;
  for (let index = 0; index < SIGNATURE_BITS; index += 1) {
    if (left[index] === right[index]) equal += 1;
  }
  return (equal / SIGNATURE_BITS) * 100;
}

function packedSignature(signature: Signature): Uint32Array {
  const words = new Uint32Array(SIGNATURE_BITS / 32);
  for (let index = 0; index < SIGNATURE_BITS; index += 1) {
    if (signature[index] === 1) words[index >>> 5] |= 1 << (index & 31);
  }
  return words;
}

function populationCount(value: number): number {
  value -= (value >>> 1) & 0x55555555;
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function packedSimilarity(left: Uint32Array, right: Uint32Array): number {
  let different = 0;
  for (let index = 0; index < left.length; index += 1) {
    different += populationCount(left[index] ^ right[index]);
  }
  return ((SIGNATURE_BITS - different) / SIGNATURE_BITS) * 100;
}

export function similarity(left: Signature, right: Signature): number {
  return hammingSimilarity(
    checkedSignature(left, 'left signature'),
    checkedSignature(right, 'right signature'),
  );
}

function normalizeText(value: string): string {
  // These two replacements cover the common differences between Unicode
  // lowercase and case-folding after compatibility normalization.
  return value
    .normalize('NFKC')
    .replace(/\u00ad/gu, '')
    .toLocaleLowerCase('und')
    .replace(/\u00df/gu, 'ss')
    .replace(/\u03c2/gu, '\u03c3')
    .trim()
    .replace(/\s+/gu, ' ');
}

function fuzzyErrors(phrase: string): number {
  const length = Array.from(phrase).length;
  if (length < 5) return 0;
  if (length < 12) return 1;
  return 2;
}

/** Match a pattern against any text substring with at most two edits. */
function hasFuzzySubstring(text: string, pattern: string, maximum: number): boolean {
  if (maximum === 0) return text.includes(pattern);

  const source = Array.from(text);
  const target = Array.from(pattern);
  let previous = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (const character of source) {
    const current = new Array<number>(target.length + 1);
    // Starting a match at any source position is free.
    current[0] = 0;
    for (let index = 1; index <= target.length; index += 1) {
      current[index] = Math.min(
        previous[index] + 1,
        current[index - 1] + 1,
        previous[index - 1] + Number(target[index - 1] !== character),
      );
    }
    if (current[target.length] <= maximum) return true;
    previous = current;
  }
  return false;
}

interface PreparedPhrase {
  normalized: string;
  errors: number;
}

function preparePhrases(rules: PhraseRule[]): PreparedPhrase[] {
  const prepared: PreparedPhrase[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    if (rule == null || typeof rule.text !== 'string' || typeof rule.fuzzy !== 'boolean') {
      throw new TypeError('phrases must contain text and fuzzy values');
    }
    const normalized = normalizeText(rule.text);
    if (!normalized) continue;
    const key = `${Number(rule.fuzzy)}\0${normalized}`;
    if (seen.has(key)) continue;
    seen.add(key);
    prepared.push({
      normalized,
      errors: rule.fuzzy ? fuzzyErrors(normalized) : 0,
    });
  }
  return prepared;
}

function matchesPhrase(text: string, phrases: PreparedPhrase[]): boolean {
  const normalized = normalizeText(text);
  return phrases.some((phrase) => normalized.includes(phrase.normalized)
    || (phrase.errors > 0
      && hasFuzzySubstring(normalized, phrase.normalized, phrase.errors)));
}

function pageSet(values: number[], pageCount: number, label: string): Set<number> {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  const result = new Set<number>();
  for (const page of values) {
    if (!Number.isInteger(page) || page < 1 || page > pageCount) {
      throw new RangeError(`${label} contains a page outside 1..${pageCount}`);
    }
    result.add(page);
  }
  return result;
}

function pageMap(pages: PageInfo[], pageCount: number): Map<number, PageInfo> {
  if (!Array.isArray(pages)) throw new TypeError('pages must be an array');
  const result = new Map<number, PageInfo>();
  for (const page of pages) {
    if (page == null || !Number.isInteger(page.number)
      || page.number < 1 || page.number > pageCount) {
      throw new RangeError(`pages contains a page outside 1..${pageCount}`);
    }
    if (result.has(page.number)) throw new RangeError(`pages contains duplicate page ${page.number}`);
    result.set(page.number, page);
  }
  return result;
}

function signatureMap(pages: Map<number, PageInfo>): Map<number, Uint32Array> {
  return new Map([...pages].map(([number, page]) => [
    number,
    packedSignature(checkedSignature(page.signature, `signature for page ${number}`)),
  ]));
}

function startKinds(
  confirmed: Set<number>,
  signatures: Map<number, Uint32Array>,
): { kinds: number[][]; kindByPage: Map<number, number> } {
  const ordered = [...confirmed].sort((left, right) => left - right);
  const parent = new Map(ordered.map((page) => [page, page]));

  const find = (page: number): number => {
    let root = page;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(page) !== page) {
      const next = parent.get(page)!;
      parent.set(page, root);
      page = next;
    }
    return root;
  };

  for (let leftIndex = 0; leftIndex < ordered.length; leftIndex += 1) {
    const leftPage = ordered[leftIndex];
    const leftSignature = signatures.get(leftPage);
    if (!leftSignature) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < ordered.length; rightIndex += 1) {
      const rightPage = ordered[rightIndex];
      const rightSignature = signatures.get(rightPage);
      if (!rightSignature) continue;
      if (packedSimilarity(leftSignature, rightSignature) >= KIND_SIMILARITY) {
        const leftRoot = find(leftPage);
        const rightRoot = find(rightPage);
        if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
      }
    }
  }

  const components = new Map<number, number[]>();
  for (const page of ordered) {
    const root = find(page);
    const component = components.get(root) ?? [];
    component.push(page);
    components.set(root, component);
  }
  const kinds = [...components.values()].sort((left, right) => left[0] - right[0]);
  const kindByPage = new Map<number, number>();
  kinds.forEach((kind, index) => {
    for (const page of kind) kindByPage.set(page, index + 1);
  });
  return { kinds, kindByPage };
}

export interface MatchPagesInput {
  pages: PageInfo[];
  pageCount: number;
  confirmed: number[];
  rejected: number[];
  threshold: number;
  phrases: PhraseRule[];
  method: Method;
}

/** Derive advisory starts from one immutable browser-session snapshot. */
export function matchPages({
  pages,
  pageCount,
  confirmed,
  rejected,
  threshold,
  phrases,
  method,
}: MatchPagesInput): MatchResult {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new RangeError('pageCount must be a positive integer');
  }
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new RangeError('threshold must be a finite number from 0 to 100');
  }
  if (method !== 'visual' && method !== 'text' && method !== 'manual') {
    throw new TypeError('method must be visual, text, or manual');
  }

  const byNumber = pageMap(pages, pageCount);
  const signatures = signatureMap(byNumber);
  const confirmedPages = pageSet(confirmed, pageCount, 'confirmed');
  const rejectedPages = pageSet(rejected, pageCount, 'rejected');
  confirmedPages.add(1);
  rejectedPages.delete(1);
  for (const page of confirmedPages) {
    if (rejectedPages.has(page)) {
      throw new RangeError('confirmed and rejected pages must be disjoint');
    }
  }

  const { kinds, kindByPage } = startKinds(confirmedPages, signatures);
  const confirmedWithSignatures = [...confirmedPages]
    .sort((left, right) => left - right)
    .flatMap((page) => {
      const signature = signatures.get(page);
      return signature ? [{ page, signature }] : [];
    });
  const rejectedSignatures = [...rejectedPages]
    .sort((left, right) => left - right)
    .flatMap((page) => {
      const signature = signatures.get(page);
      return signature ? [signature] : [];
    });
  const preparedPhrases = preparePhrases(phrases);

  const pageMatches: MatchResult['pages'] = [];
  const suggested: number[] = [];
  const unsure: number[] = [];

  for (let page = 1; page <= pageCount; page += 1) {
    const info = byNumber.get(page);
    let score: number | null = null;
    let closest: number | null = null;
    let kind = kindByPage.get(page) ?? null;
    let vetoed = false;

    const signature = signatures.get(page);
    if (method === 'visual' && signature && confirmedWithSignatures.length > 0) {
      let positive = -1;
      for (const anchor of confirmedWithSignatures) {
        const candidate = packedSimilarity(signature, anchor.signature);
        if (candidate > positive || (candidate === positive
          && (closest == null || anchor.page < closest))) {
          positive = candidate;
          closest = anchor.page;
        }
      }
      score = Math.round(positive * 10) / 10;
      kind = kindByPage.get(closest!) ?? null;
      vetoed = rejectedSignatures.some(
        (negative) => packedSimilarity(signature, negative) >= positive,
      );
    }

    const phrase = method === 'text' && info != null
      ? matchesPhrase(info.text, preparedPhrases)
      : false;
    const labeled = confirmedPages.has(page) || rejectedPages.has(page);
    const isSuggested = !labeled && (
      (method === 'visual' && !vetoed && score != null && score >= threshold)
      || (method === 'text' && phrase)
    );

    pageMatches.push({ page, score, closest, kind, phrase, suggested: isSuggested });
    if (isSuggested) suggested.push(page);
    if (method === 'visual' && !labeled && !isSuggested
      && score != null && score >= threshold - UNSURE_BAND) {
      unsure.push(page);
    }
  }

  return { pages: pageMatches, suggested, unsure, kinds };
}

/** Convert confirmed starts into inclusive, ordered output ranges. */
export function splitRanges(
  pageCount: number,
  starts: number[],
  basename: string,
): OutputDocument[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new RangeError('pageCount must be a positive integer');
  }
  const confirmed = pageSet(starts, pageCount, 'starts');
  confirmed.add(1);
  const ordered = [...confirmed].sort((left, right) => left - right);
  const prefix = basename.trim().replace(/\.pdf$/iu, '') || 'packet';
  const pageWidth = Math.max(3, String(pageCount).length);

  return ordered.map((start, index) => {
    const end = index + 1 < ordered.length ? ordered[index + 1] - 1 : pageCount;
    return {
      start,
      end,
      filename: `${prefix}_${String(index + 1).padStart(3, '0')}`
        + `_pages_${String(start).padStart(pageWidth, '0')}`
        + `-${String(end).padStart(pageWidth, '0')}.pdf`,
    };
  });
}
