#!/usr/bin/env bun
// Scores each run in runs/ and writes runs/report.md. Each model gets 12 rows:
// the 6 directions and the 6 kinds. A kind row holds the translations of that
// kind in all 6 directions. The report gives scores only and orders the models
// by name. It does not say that one model is better than another.
//
//   bun scripts/report.ts
import { readdir } from "node:fs/promises";
import { corpusChrf } from "./chrf.ts";
import { DIRECTIONS, KINDS, loadTasks, type Task } from "./tasks.ts";

type Answer = { key: string; answer: string; noAnswer: boolean };
type Row = { label: string; chrf: number; noAnswers: number; translations: number };

const runsDir = `${new URL("..", import.meta.url).pathname}runs`;
const tasks = await loadTasks();

const row = (label: string, items: { task: Task; answer: Answer }[]): Row => ({
  label,
  // A no answer counts as an empty translation in the score.
  chrf: corpusChrf(items.map(({ task, answer }) => ({ hyp: answer.noAnswer ? "" : answer.answer, ref: task.reference }))),
  noAnswers: items.filter(({ answer }) => answer.noAnswer).length,
  translations: items.length,
});

const scoreRun = (answers: Answer[]): { rows: Row[]; missing: number } => {
  const byKey = new Map(answers.map((a) => [a.key, a]));
  const items = tasks.flatMap((task) => {
    const answer = byKey.get(task.key);
    return answer ? [{ task, answer }] : [];
  });
  const rows = [
    ...DIRECTIONS.map(([s, t]) => row(`${s} → ${t}`, items.filter((i) => i.task.direction === `${s}-${t}`))),
    ...KINDS.map((k) => row(k, items.filter((i) => i.task.kind === k))),
  ];
  return { rows, missing: tasks.length - items.length };
};

const runs = (await readdir(runsDir, { withFileTypes: true }).catch(() => []))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const lines = [
  "# Translation report",
  "",
  "chrF++ is the corpus chrF++ of the row, from 0 to 100. A no answer is an empty final answer or a stop at the token limit. The score counts it as an empty translation.",
  "",
];
for (const run of runs) {
  const file = Bun.file(`${runsDir}/${run}/answers.jsonl`);
  if (!(await file.exists())) continue;
  const answers = (await file.text()).split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Answer);
  const { rows, missing } = scoreRun(answers);
  lines.push(`## ${run}`, "");
  if (missing) lines.push(`The run is not complete: ${missing} of ${tasks.length} translations are missing.`, "");
  lines.push("| Row | chrF++ | No answers | Translations |", "|---|---:|---:|---:|");
  for (const r of rows) lines.push(`| ${r.label} | ${r.chrf.toFixed(1)} | ${r.noAnswers} | ${r.translations} |`);
  lines.push("");
}
if (!runs.length) lines.push("No runs yet.", "");
await Bun.write(`${runsDir}/report.md`, lines.join("\n"));
console.error(`runs/report.md: ${runs.length} runs`);
