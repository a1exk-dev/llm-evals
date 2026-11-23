# Translation eval

The eval translates 110 texts in 6 directions between en, pl, and ru. Code scores the answers with corpus chrF++. The report gives the scores of each model. It does not say that one model is better than another. "Decide the v1 translation eval" (https://github.com/a1exk-dev/llm-evals/issues/21) gives the decisions. `SOURCES.md` gives the sources of the texts and their licenses.

## Run a model

1. Start `llama-server` with the sampling flags that the vendor of the model recommends. The runner sends no sampling fields and no reasoning setting. The chat template of the model selects the reasoning mode.
2. Run the runner in this folder. `<id>` is a model id from `GET /v1/models`:

   ```sh
   bun scripts/translate.ts --model <id> --server http://127.0.0.1:8080 --parallel 1
   ```

   Set `--parallel` to the `--parallel` value of `llama-server` for a shorter run. When the runner stops, start the same command again. The runner skips the translations that it already has.
3. Write the report:

   ```sh
   bun scripts/report.ts
   ```

## Files of a run

| File | Content |
|---|---|
| `runs/<run>/answers.jsonl` | One line for each translation: the final answer, the no-answer flag, the finish reason, and the token counts. |
| `runs/<run>/server.json` | For each start of the runner: the model entry of `/v1/models` with the launch arguments, and `/props` with the sampling settings and `build_info`. |
| `runs/report.md` | 12 rows for each run: 6 directions and 6 kinds, with chrF++ and the number of no answers. |

`<run>` is the model id. Each character other than a letter, a digit, `.`, `_`, or `-` becomes `_`. Git ignores `runs/`.

## Rules of the score

- The prompt is one user message: `Translate this text from Polish to Russian. Give only the translation.`, a blank line, and the source text.
- The score uses the final answer without the reasoning, with the outer spaces removed. A preamble such as "Here is the translation:" stays in the answer.
- A no answer is an empty final answer, or a stop at 8,192 output tokens. The score counts a no answer as an empty translation. After 3 failed attempts, a server error stops the run.
- chrF++ uses character n-grams of 1 to 6, word n-grams of 1 to 2, and beta 2. A kind row holds the translations of that kind in all 6 directions.

## Test the chrF++ code

```sh
bun test tests/
```

`tests/chrf-values.json` holds the corpus chrF++ of sacreBLEU 2.5.1 for each case in `tests/chrf-cases.json`. When you change the cases, run `tests/make-chrf-values.sh`. That script runs sacreBLEU through `uvx`. The eval itself needs no Python.
