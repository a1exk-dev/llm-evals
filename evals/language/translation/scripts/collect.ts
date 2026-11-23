#!/usr/bin/env bun
// Extracts the candidates of each kind from .cache/, draws the texts with a
// fixed seed, and writes data/originals.jsonl.
// Run scripts/fetch-sources.sh first.
import { Glob } from "bun";
import { createHash } from "node:crypto";

const here = new URL("..", import.meta.url).pathname;
const cache = `${here}.cache`;
const SEED = "issue-21";

type Lang = "en" | "pl" | "ru";
type Kind = "speech" | "news" | "it-docs" | "emails" | "documents" | "studies";
// Candidates of one family are near-duplicates. The draw takes at most one
// candidate of each family. A candidate with no family is its own family.
type Candidate = { ref: string; en: string; pl: string; ru: string; family?: string };

const COUNTS: Record<Kind, number> = {
  speech: 20,
  news: 10,
  "it-docs": 20,
  emails: 20,
  documents: 20,
  studies: 20,
};
const UNEXPECTED_PER_KIND = 5;

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const inRange = (en: string) => words(en) >= 20 && words(en) <= 150;
const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();
// Markdown links keep their text and lose the URL.
const unlink = (s: string) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
const ENTITIES: Record<string, string> = { mdash: "—", ndash: "–", nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"' };
const decode = (s: string) => s.replace(/&(\w+);/g, (m, e) => ENTITIES[e] ?? m);
const read = (p: string) => Bun.file(`${cache}/${p}`).text();

// Numbers and inline code spans must agree, so that a pair aligned by
// position is the same paragraph in the 3 languages.
const signature = (s: string) =>
  [...s.matchAll(/`[^`]+`|\d+/g)].map((m) => m[0]).sort().join("|");
const agree = (c: Candidate) =>
  signature(c.en) === signature(c.pl) && signature(c.en) === signature(c.ru);

async function wmt(domain: "speech" | "news"): Promise<Candidate[]> {
  const load = async (pair: string) =>
    (await read(`wmt24pp/${pair}.jsonl`)).trim().split("\n").map((l) => JSON.parse(l));
  const [pl, ru] = await Promise.all([load("en-pl_PL"), load("en-ru_RU")]);
  return pl
    .map((p, i) => [p, ru[i]])
    .filter(([p, r]) => p.domain === domain && p.source === r.source)
    .filter(([p, r]) => !p.is_bad_source && !r.is_bad_source && inRange(p.source))
    .map(([p, r]) => ({
      ref: `${p.document_id}#${p.segment_id}`,
      en: p.source,
      pl: p.target,
      ru: r.target,
    }));
}

// Prose paragraphs of a Markdown page: no heading, list, table, quote, HTML,
// or fenced code.
function paragraphs(md: string): string[] {
  const out: string[] = [];
  let inCode = false;
  for (const block of md.replace(/^---\n[\s\S]*?\n---\n/, "").split(/\n\s*\n/)) {
    const s = block.trim();
    if (!s) continue;
    const fences = (s.match(/^\s*```/gm) || []).length;
    if (inCode || fences) {
      if (fences % 2) inCode = !inCode;
      out.push("");
      continue;
    }
    out.push(/^(#|[-*+] |\d+\. |\||<|!\[|>|\s{4}|\$\$)/.test(s) ? "" : oneLine(s));
  }
  return out;
}

async function kubernetes(): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const base = "kubernetes/content";
  const files = await Array.fromAsync(new Glob("**/*.md").scan(`${cache}/${base}/pl/docs`));
  for (const f of files.sort()) {
    const path = (l: Lang) => `${cache}/${base}/${l}/docs/${f}`;
    if (!(await Bun.file(path("en")).exists()) || !(await Bun.file(path("ru")).exists())) continue;
    const [en, pl, ru] = await Promise.all(
      (["en", "pl", "ru"] as Lang[]).map(async (l) => paragraphs(await Bun.file(path(l)).text())),
    );
    if (en.length !== pl.length || en.length !== ru.length) continue;
    en.forEach((e, i) => {
      const c = { ref: `content/{en,pl,ru}/docs/${f}#p${i}`, en: e, pl: pl[i], ru: ru[i] };
      if (!e || !c.pl || !c.ru || [e, c.pl, c.ru].some((x) => /\{\{[<%]/.test(x))) return;
      if (inRange(e) && agree(c)) out.push({ ...c, en: decode(unlink(e)), pl: decode(unlink(c.pl)), ru: decode(unlink(c.ru)) });
    });
  }
  return out;
}

// A placeholder for a name, a title, a URL, a number, or a code has one
// invented value, the same in en, pl, and ru. A placeholder for free text has
// one value for each language.
const PLACEHOLDERS: Record<string, string | Record<Lang, string>> = await Bun.file(
  `${here}data/email-placeholders.json`,
).json();

function fill(s: string, lang: Lang): string {
  return s.replace(/%\{([^}]+)\}/g, (_, k) => {
    const v = PLACEHOLDERS[k];
    if (v === undefined) throw new Error(`no value for placeholder %{${k}}`);
    return typeof v === "string" ? v : v[lang];
  });
}

// Two emails are in one family when they share a line of 6 or more words, or
// when 60% or more of their distinct words are the same.
function withFamilies(xs: Candidate[]): Candidate[] {
  const parent = xs.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  const owner = new Map<string, number>();
  xs.forEach((x, i) => {
    for (const line of x.en.split("\n").map((l) => l.trim())) {
      if (words(line) < 6) continue;
      const j = owner.get(line);
      if (j === undefined) owner.set(line, i);
      else parent[root(i)] = root(j);
    }
  });
  const bags = xs.map((x) => new Set(x.en.toLowerCase().split(/\s+/).filter(Boolean)));
  bags.forEach((a, i) =>
    bags.slice(i + 1).forEach((b, k) => {
      const shared = [...a].filter((w) => b.has(w)).length;
      if (shared / (a.size + b.size - shared) >= 0.6) parent[root(i + 1 + k)] = root(i);
    }),
  );
  return xs.map((x, i) => ({ ...x, family: xs[root(i)].ref }));
}

async function discourse(): Promise<Candidate[]> {
  const load = async (l: string) =>
    Object.values(Bun.YAML.parse(await read(`discourse/config/locales/server.${l}.yml`)) as object)[0];
  const [en, pl, ru] = await Promise.all(["en", "pl_PL", "ru"].map(load));
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const walk = (e: any, p: any, r: any, path: string[]) => {
    if (!e || typeof e !== "object") return;
    for (const k of Object.keys(e)) {
      const [a, b, c] = [e[k], p?.[k], r?.[k]];
      if (k !== "text_body_template") {
        walk(a, b, c, [...path, k]);
        continue;
      }
      if (![a, b, c].every((x) => typeof x === "string")) continue;
      if (seen.has(a) || !inRange(a)) continue;
      seen.add(a);
      out.push({ ref: `${path.join(".")}.text_body_template`, en: a.trim(), pl: b.trim(), ru: c.trim() });
    }
  };
  walk(en, pl, ru, []);
  return withFamilies(out);
}

// The own text of each <li> and <p> in the legal code: the text of nested
// items goes to the nested unit.
async function legalUnits(lang: Lang) {
  const units: { id: string; text: string }[] = [];
  const stack: { id: string; text: string }[] = [];
  let n = 0;
  await new HTMLRewriter()
    .on("#legal-code-body li, #legal-code-body p", {
      element(el) {
        const u = { id: el.getAttribute("id") ?? `u${n++}`, text: "" };
        stack.push(u);
        units.push(u);
        el.onEndTag(() => void stack.pop());
      },
    })
    .on("#legal-code-body *", {
      text(t) {
        if (stack.length) stack[stack.length - 1].text += t.text;
      },
    })
    .transform(new Response(await read(`cc-by-4.0/${lang}.html`)))
    .text();
  return units.map((u) => ({ id: u.id, text: oneLine(u.text.replace(/\s+/g, " ")) }));
}

async function legalCode(): Promise<Candidate[]> {
  const [en, pl, ru] = await Promise.all((["en", "pl", "ru"] as Lang[]).map(legalUnits));
  if (en.length !== pl.length || en.length !== ru.length) throw new Error("legal code units differ");
  return en
    .map((e, i) => ({ ref: `legalcode#${e.id}`, en: e.text, pl: pl[i].text, ru: ru[i].text, ids: [e.id, pl[i].id, ru[i].id] }))
    .filter((c) => c.ids.every((id) => id === c.ids[0]) && inRange(c.en))
    .map(({ ids, ...c }) => c);
}

// The en and ru whitepapers align by position. The pl whitepaper has more
// blocks, so data/studies-pl-map.json gives the pl block of each text.
// A superscript after a digit is a power: 2<sup>187</sup> becomes 2^187.
// Each other superscript is a note mark, and goes away.
const clean = (s: string) =>
  unlink(s.replace(/\\([~*_`\[\]()#+.!-])/g, "$1"))
    .replace(/(\d)<sup>([^<]+)<\/sup>/g, "$1^$2").replace(/<sup>[^<]*<\/sup>/g, "");

async function whitepaper(): Promise<Candidate[]> {
  const path = (l: Lang) =>
    l === "en" ? "ethereum/public/content/whitepaper/index.md" : `ethereum/public/content/translations/${l}/whitepaper/index.md`;
  const [en, pl, ru] = await Promise.all((["en", "pl", "ru"] as Lang[]).map(async (l) => paragraphs(await read(path(l)))));
  const plMap: Record<string, number[]> = await Bun.file(`${here}data/studies-pl-map.json`).json();
  const out: Candidate[] = [];
  en.forEach((e, i) => {
    // An italic block is an editorial note or a figure caption of ethereum.org.
    if (!e || !ru[i] || !inRange(e) || /\$/.test(e) || /^_.*_$/.test(e)) return;
    if (signature(e) !== signature(ru[i])) return;
    const ref = `whitepaper/index.md#p${i}`;
    const plText = (plMap[ref] ?? []).map((j) => pl[j]).join(" ");
    out.push({ ref, en: clean(e), pl: clean(plText), ru: clean(ru[i]) });
  });
  return out;
}

// Rank by a hash of the seed and the ref, then take the lowest. When a
// candidate leaves the set, the other candidates keep their places.
const rank = (salt: string, ref: string) =>
  createHash("sha256").update(`${SEED}:${salt}:${ref}`).digest("hex");
function draw<T extends { ref: string; family?: string }>(salt: string, xs: T[], n: number): T[] {
  const taken = new Set<string>();
  const out: T[] = [];
  for (const x of [...xs].sort((a, b) => (rank(salt, a.ref) < rank(salt, b.ref) ? -1 : 1))) {
    const family = x.family ?? x.ref;
    if (out.length === n || taken.has(family)) continue;
    taken.add(family);
    out.push(x);
  }
  return out;
}

const sources: Record<Kind, () => Promise<Candidate[]>> = {
  speech: () => wmt("speech"),
  news: () => wmt("news"),
  "it-docs": kubernetes,
  emails: discourse,
  documents: legalCode,
  studies: whitepaper,
};

const rows: string[] = [];
for (const [kind, load] of Object.entries(sources) as [Kind, () => Promise<Candidate[]>][]) {
  const candidates = await load();
  const texts = draw(kind, candidates, COUNTS[kind]);
  const marked = new Set(draw(`${kind}:unexpected`, texts, UNEXPECTED_PER_KIND).map((t) => t.ref));
  const families = new Set(candidates.map((c) => c.family ?? c.ref)).size;
  console.error(`${kind}: ${candidates.length} candidates, ${families} families, ${texts.length} texts`);
  texts.forEach((t, i) => {
    const text = kind === "emails" ? { ...t, en: fill(t.en, "en"), pl: fill(t.pl, "pl"), ru: fill(t.ru, "ru") } : t;
    if (!text.pl) throw new Error(`${kind} ${t.ref}: no pl text`);
    rows.push(
      JSON.stringify({
        id: `${kind}-${String(i + 1).padStart(2, "0")}`,
        kind,
        ref: t.ref,
        unexpected: marked.has(t.ref),
        en: text.en,
        pl: text.pl,
        ru: text.ru,
      }),
    );
  });
}
await Bun.write(`${here}data/originals.jsonl`, rows.join("\n") + "\n");
