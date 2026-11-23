// The 660 translations of a run: each of the 110 texts in each of the 6 directions.
const here = new URL("..", import.meta.url).pathname;

export const LANGS = { en: "English", pl: "Polish", ru: "Russian" } as const;
export type Lang = keyof typeof LANGS;

export const DIRECTIONS = [
  ["en", "pl"],
  ["pl", "en"],
  ["en", "ru"],
  ["ru", "en"],
  ["pl", "ru"],
  ["ru", "pl"],
] as const satisfies readonly (readonly [Lang, Lang])[];

export const KINDS = ["speech", "news", "it-docs", "emails", "documents", "studies"] as const;
export type Kind = (typeof KINDS)[number];

export type Task = {
  /** Text id and direction, for example `speech-01:en-pl`. */
  key: string;
  textId: string;
  kind: Kind;
  direction: string;
  source: string;
  reference: string;
  prompt: string;
};

export const prompt = (src: Lang, tgt: Lang, text: string) =>
  `Translate this text from ${LANGS[src]} to ${LANGS[tgt]}. Give only the translation.\n\n${text}`;

export const loadTasks = async (): Promise<Task[]> => {
  const rows = (await Bun.file(`${here}data/texts.jsonl`).text())
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as { id: string; kind: Kind } & Record<Lang, string>);
  return rows.flatMap((t) =>
    DIRECTIONS.map(([src, tgt]) => ({
      key: `${t.id}:${src}-${tgt}`,
      textId: t.id,
      kind: t.kind,
      direction: `${src}-${tgt}`,
      source: t[src],
      reference: t[tgt],
      prompt: prompt(src, tgt, t[src]),
    })),
  );
};
