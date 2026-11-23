// Corpus chrF++ with the defaults of sacreBLEU 2.x: character n-grams of 1 to 6,
// word n-grams of 1 to 2, beta 2, case-sensitive, no whitespace in character
// n-grams, and no eps smoothing. chrf.test.ts checks it against sacreBLEU results.
export const CHAR_ORDER = 6;
export const WORD_ORDER = 2;
export const BETA = 2;

// string.punctuation of Python. sacreBLEU splits only these characters off a word.
const PUNCTS = new Set("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~");

type Counts = Map<string, number>;

const count = (items: string[]): Counts => {
  const c: Counts = new Map();
  for (const i of items) c.set(i, (c.get(i) ?? 0) + 1);
  return c;
};

// Python str.split() with no argument: split on whitespace, drop empty parts.
const splitWords = (s: string) => s.split(/\s+/u).filter(Boolean);

const ngrams = (units: string[], n: number, join: string) => {
  const out: string[] = [];
  for (let i = 0; i + n <= units.length; i++) out.push(units.slice(i, i + n).join(join));
  return count(out);
};

// sacreBLEU removes one punctuation character from the end of a word, else from the start.
const wordsOf = (s: string) => {
  const out: string[] = [];
  for (const w of splitWords(s)) {
    const cs = Array.from(w);
    if (cs.length === 1) out.push(w);
    else if (PUNCTS.has(cs.at(-1)!)) out.push(cs.slice(0, -1).join(""), cs.at(-1)!);
    else if (PUNCTS.has(cs[0]!)) out.push(cs[0]!, cs.slice(1).join(""));
    else out.push(w);
  }
  return out;
};

const allNgrams = (s: string): Counts[] => {
  const chars = Array.from(splitWords(s).join(""));
  const words = wordsOf(s);
  const out: Counts[] = [];
  for (let n = 1; n <= CHAR_ORDER; n++) out.push(ngrams(chars, n, ""));
  for (let n = 1; n <= WORD_ORDER; n++) out.push(ngrams(words, n, " "));
  return out;
};

/** For each n-gram order: [hypothesis n-grams, reference n-grams, matches]. */
export const segmentStats = (hyp: string, ref: string): number[] => {
  const h = allNgrams(hyp);
  const r = allNgrams(ref);
  const stats: number[] = [];
  h.forEach((hc, i) => {
    const rc = r[i]!;
    let nHyp = 0;
    let nMatch = 0;
    for (const [g, k] of hc) {
      nHyp += k;
      nMatch += Math.min(k, rc.get(g) ?? 0);
    }
    let nRef = 0;
    for (const k of rc.values()) nRef += k;
    stats.push(nHyp, nRef, nMatch);
  });
  return stats;
};

/** chrF++ from summed statistics, 0 to 100. */
export const fScore = (stats: number[]): number => {
  const factor = BETA ** 2;
  let prec = 0;
  let rec = 0;
  let order = 0;
  for (let i = 0; i < stats.length; i += 3) {
    const [nHyp, nRef, nMatch] = stats.slice(i, i + 3) as [number, number, number];
    if (nHyp > 0 && nRef > 0) {
      prec += nMatch / nHyp;
      rec += nMatch / nRef;
      order++;
    }
  }
  if (order === 0) return 0;
  prec /= order;
  rec /= order;
  if (prec + rec === 0) return 0;
  return (100 * (1 + factor) * prec * rec) / (factor * prec + rec);
};

/** Corpus chrF++: sums the statistics of all segments, then computes one score. */
export const corpusChrf = (pairs: { hyp: string; ref: string }[]): number => {
  const sum = new Array<number>(3 * (CHAR_ORDER + WORD_ORDER)).fill(0);
  for (const { hyp, ref } of pairs) segmentStats(hyp, ref).forEach((v, i) => (sum[i]! += v));
  return fScore(sum);
};
