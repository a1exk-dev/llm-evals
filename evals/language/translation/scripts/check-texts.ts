#!/usr/bin/env bun
// Checks data/texts.jsonl against data/originals.jsonl. Exits with 1 and
// prints each fault when a changed text breaks a rule of the eval.
const here = new URL("..", import.meta.url).pathname;
const LANGS = ["en", "pl", "ru"] as const;

const readJsonl = async (p: string) =>
  (await Bun.file(p).text()).trim().split("\n").map((l) => JSON.parse(l));
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

const originals = await readJsonl(`${here}data/originals.jsonl`);
const texts = new Map((await readJsonl(`${here}data/texts.jsonl`)).map((t) => [t.id, t]));

const faults: string[] = [];
for (const o of originals) {
  const t = texts.get(o.id);
  if (!t) {
    faults.push(`${o.id}: no changed text`);
    continue;
  }
  if (t.kind !== o.kind || t.ref !== o.ref) faults.push(`${o.id}: kind or ref differs from the original`);
  for (const l of LANGS) {
    if (typeof t[l] !== "string" || !t[l].trim()) faults.push(`${o.id}: no ${l} text`);
    else if (t[l] === o[l]) faults.push(`${o.id}: ${l} text did not change`);
  }
  const hasPiece = typeof t.unexpected === "string";
  if (o.unexpected !== hasPiece) faults.push(`${o.id}: unexpected piece does not agree with the draw`);
  if (hasPiece && !t.en.includes(t.unexpected)) faults.push(`${o.id}: en text does not hold its unexpected piece`);
  const n = words(t.en ?? "");
  if (n < 20 || n > 150) faults.push(`${o.id}: ${n} English words`);
  if (o.kind === "documents" && LANGS.some((l) => /creative\s*commons/i.test(t[l] ?? "")))
    faults.push(`${o.id}: names Creative Commons`);
}
for (const id of texts.keys()) if (!originals.some((o) => o.id === id)) faults.push(`${id}: no original`);

if (faults.length) {
  console.error(faults.join("\n"));
  process.exit(1);
}
console.error(`${texts.size} texts pass`);
