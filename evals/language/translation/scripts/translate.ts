#!/usr/bin/env bun
// Sends the 660 translations of the eval to a running llama-server and writes
// the answers to runs/<run>/answers.jsonl. The runner sends no sampling fields
// and no reasoning setting: the launch flags of llama-server and the chat
// template of the model control them. runs/<run>/server.json records them.
//
//   bun scripts/translate.ts --model <id> [--server http://127.0.0.1:8080] [--parallel 1]
//
// <id> is the model id that GET /v1/models gives. <run> is the id with each
// character other than a letter, a digit, '.', '_', or '-' replaced by '_'.
// A second start with the same --model skips the translations that
// answers.jsonl already holds.
import { appendFile, mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { loadTasks, type Task } from "./tasks.ts";

const MAX_TOKENS = 8192;
const RETRIES = 3;

const { values: args } = parseArgs({
  options: {
    model: { type: "string" },
    server: { type: "string", default: "http://127.0.0.1:8080" },
    parallel: { type: "string", default: "1" },
  },
});
const model = args.model;
const parallel = Number(args.parallel);
if (!model || !Number.isInteger(parallel) || parallel < 1) {
  console.error("Usage: bun scripts/translate.ts --model <id> [--server <url>] [--parallel <n>]");
  process.exit(2);
}
const server = args.server!.replace(/\/+$/, "");
const dir = `${new URL("..", import.meta.url).pathname}runs/${model.replace(/[^\w.-]/g, "_")}`;
await mkdir(dir, { recursive: true });

const getJson = async (path: string) => {
  const r = await fetch(`${server}${path}`);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
};

const models = (await getJson("/v1/models")).data as { id: string }[];
const entry = models.find((m) => m.id === model);
if (!entry) {
  console.error(`The server has no model "${model}". It has:\n${models.map((m) => `  ${m.id}`).join("\n")}`);
  process.exit(2);
}

const answersFile = `${dir}/answers.jsonl`;
const done = new Set<string>();
if (await Bun.file(answersFile).exists())
  for (const l of (await Bun.file(answersFile).text()).split("\n"))
    if (l.trim()) done.add(JSON.parse(l).key);

// llama-server puts the reasoning in reasoning_content. When the server does not
// split it, the content starts with a <think> block. The score excludes the reasoning.
const finalAnswer = (content: string) => content.replace(/^\s*<think>[\s\S]*?<\/think>/, "").trim();

const translate = async (t: Task) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(`${server}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: t.prompt }], max_tokens: MAX_TOKENS }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      const body = await r.json();
      const choice = body.choices[0];
      const answer = finalAnswer(choice.message.content ?? "");
      return {
        key: t.key,
        answer,
        // No answer: an empty final answer, or a stop at the token limit.
        noAnswer: answer === "" || choice.finish_reason === "length",
        finishReason: choice.finish_reason,
        reasoningChars: (choice.message.reasoning_content ?? "").length,
        usage: body.usage,
        timings: body.timings,
      };
    } catch (e) {
      // A server error is not a no answer. After the last retry, the run stops.
      if (attempt >= RETRIES) throw new Error(`${t.key}: ${e}`);
      console.error(`${t.key}: attempt ${attempt} failed: ${e}`);
      await Bun.sleep(2000 * attempt);
    }
  }
};

// Records the server settings of each start. A change between two starts of one run shows here.
// In router mode, /v1/models gives the launch arguments, and /props?model= gives the
// settings after the model loads.
const recordServer = async () => {
  const props = await getJson(`/props?model=${encodeURIComponent(model)}`).catch(() => getJson("/props"));
  const log = Bun.file(`${dir}/server.json`);
  const starts = (await log.exists()) ? await log.json() : [];
  starts.push({ startedAt: new Date().toISOString(), server, maxTokens: MAX_TOKENS, model: entry, props });
  await Bun.write(log, JSON.stringify(starts, null, 2) + "\n");
};

const todo = (await loadTasks()).filter((t) => !done.has(t.key));
console.error(`${model}: ${done.size} done, ${todo.length} to translate`);
const startMs = Date.now();
let next = 0;
let n = 0;
let recorded = false;
const worker = async () => {
  while (next < todo.length) {
    const a = await translate(todo[next++]!);
    if (!recorded) {
      // The first answer loads the model, so its settings are then known.
      recorded = true;
      await recordServer();
    }
    await appendFile(answersFile, JSON.stringify(a) + "\n");
    if (++n % 10 === 0 || n === todo.length)
      console.error(`${n}/${todo.length} in ${((Date.now() - startMs) / 60000).toFixed(1)} min`);
  }
};
await Promise.all(Array.from({ length: Math.min(parallel, todo.length) }, worker));
if (todo.length === 0) await recordServer();
