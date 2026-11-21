# Eval frameworks for a local-first harness

Research for the ticket [Survey eval frameworks for a local-first harness](https://github.com/a1exk-dev/llm-evals/issues/3). Sources checked on 2026-11-21.

## Answer

Adopt Inspect AI as the eval engine. Do not build an own engine. Build only a thin layer on top of Inspect AI: the TUI launcher, the llama-server profiles, and the comparison reports.

The reasons:

- Inspect AI is the only candidate that has all of these in one package: an OpenAI-compatible provider, agent loops with tools, model-graded scorers with a separate grader model, and a terminal UI.
- The companion repo `inspect_evals` already has ready tasks for most v1 areas: long context (`niah`, `infinite_bench`), instruction following (`ifeval`), tool calls (`bfcl`, `tau2`), agents (`gaia`, `assistant_bench`), hallucination (`simpleqa`, `truthfulqa`), and public benchmarks (`gpqa`, `mmlu_pro`, `bbh`).
- The Anthropic provider of Inspect AI accepts an `--effort` option. One harness can thus run the local models and the Opus 5.5 medium reference.
- MIT license, and the most active repo of the 5 candidates (a release every few days).

Keep lm-evaluation-harness as an optional second tool. Use lm-evaluation-harness only if a v1 setup needs log-likelihood scores from llama-server (multiple choice by token probability). Do not use promptfoo, OpenAI simple-evals, or DeepEval as the engine.

## Comparison

| Criterion | Inspect AI | lm-evaluation-harness | promptfoo | OpenAI simple-evals | DeepEval |
|---|---|---|---|---|---|
| llama-server (OpenAI-compatible) | Yes. `openai-api/<name>/<model>` plus `<NAME>_BASE_URL` | Yes. `local-chat-completions`, `local-completions`, and a dedicated `gguf` type for llama-server | Yes. `openai:chat:<model>` with `apiBaseUrl`, or the `llama` provider | Only through the `OPENAI_BASE_URL` variable of the OpenAI SDK. The model list is hard-coded. | Yes for the judge (`LOCAL_MODEL_BASE_URL`). The model under test is your own `DeepEvalBaseLLM` class. |
| Multi-step and agentic tasks | Yes. `react()` agent, tools, multi-agent, sandboxes | No. Single-turn requests only | Partly. Your own provider runs the agent loop. A simulated user drives multi-turn tests. | No | Partly. You trace your own agent with `@observe` and score the trace. |
| Long-context tasks | Yes. `niah` (context sizes and needle positions as parameters), `infinite_bench` | Yes. `ruler`, `longbench`, `longbench2`, `babilong`, `infinitebench`, `scrolls`, `longproc` | No built-in tasks | No | No built-in tasks |
| LLM-as-judge | Yes. `model_graded_qa`, `model_graded_fact`, a `grader` model role | No general judge scorer | Yes. `llm-rubric`, `g-eval`, `factuality`, `trajectory:goal-success`, and more | Only per eval (SimpleQA, HealthBench) | Yes. This is the core of DeepEval (G-Eval and many metrics) |
| TUI or CLI | CLI, and a Textual terminal UI during runs. `inspect view` is a web viewer. | CLI only (`lm-eval run`, `ls`, `validate`) | CLI, and a local web viewer (`promptfoo view`) | One Python script | CLI (`deepeval test run`, pytest style) |
| Result format | `.eval` logs (zip, default) or `.json`. Python API and data frames read the logs. | `results_<date>.json`, and `samples_<task>_<date>.jsonl` with `--log_samples` | JSON, JSONL, CSV, YAML, HTML, XML, JUnit XML | JSON and HTML files in `/tmp` | `test_run_<date>.json`, or SQLite with `DEEPEVAL_LOCAL_STORE=sqlite` |
| Language | Python | Python | TypeScript (Node.js) | Python | Python (also a TypeScript port) |
| License | MIT | MIT | MIT | MIT | Apache-2.0 |
| Last release | 0.3.291, 2026-11-17 | v0.4.13, 2026-08-31 | 0.126.0, 2026-11-18 | No releases | python-v4.2.4, 2026-09-22 |
| Commits since 2026-08-21 | 100 or more | 57 | 100 or more | 0 | 100 or more |
| GitHub stars | 3.3k | 14.5k | 27.5k | 4.7k | 19.6k |

## Inspect AI

Repo: [UKGovernmentBEIS/inspect_ai](https://github.com/UKGovernmentBEIS/inspect_ai). Docs: [inspect.aisi.org.uk](https://inspect.aisi.org.uk/).

- **Model**: An evaluation is a Task with 3 parts: a dataset, a solver, and a scorer ([docs](https://inspect.aisi.org.uk/)).
- **llama-server**: The `openai-api` provider connects to each OpenAI-compatible server. The model name is `openai-api/<provider-name>/<model-name>`. The provider reads `<PROVIDER_NAME>_API_KEY` and `<PROVIDER_NAME>_BASE_URL` ([providers](https://inspect.aisi.org.uk/providers.html)). The CLI also has `--model-base-url` and `-M key=value` ([options](https://inspect.aisi.org.uk/options.html)). Example for llama-server:

  ```bash
  export LLAMACPP_API_KEY=none
  export LLAMACPP_BASE_URL=http://127.0.0.1:8080/v1
  inspect eval inspect_evals/ifeval --model openai-api/llamacpp/qwen3
  ```

  The docs list a `llama-cpp-python` provider, but do not name llama-server. The `openai-api` provider is the path for llama-server.
- **Agents**: The built-in `react()` agent runs a reason-act-observe loop. Inspect AI has multi-agent primitives, built-in tools (bash, python, text editor, web search, computer), and sandboxes in Docker, Kubernetes, or Modal ([docs](https://inspect.aisi.org.uk/)).
- **Judge**: `model_graded_qa()` and `model_graded_fact()` grade an answer against the `target`. The grader is a separate model. The default model role is `grader`, and the CLI binds the role with `--model-role` ([source](https://github.com/UKGovernmentBEIS/inspect_ai/blob/main/src/inspect_ai/scorer/_model.py)). A local model can thus run the task while Opus 5.5 grades, or the reverse.
- **Effort**: `inspect eval` has an `--effort` option. The Anthropic provider sends the effort value to the API ([source](https://github.com/UKGovernmentBEIS/inspect_ai/blob/main/src/inspect_ai/model/_providers/anthropic.py)).
- **TUI**: The default `--display full` mode is a Textual application. The package depends on `textual>=6.2.0` and has `src/inspect_ai/_display/textual/` ([pyproject](https://github.com/UKGovernmentBEIS/inspect_ai/blob/main/pyproject.toml)). This TUI shows the progress of a run. This TUI is not a launcher where you select models and tasks.
- **Results**: The default log format is `.eval`, a binary format about 1/8 the size of `.json`. `inspect log convert` changes the format. The `inspect_ai.log` API reads logs (`read_eval_log`, `read_eval_log_samples`, `list_eval_logs`), and a data-frame API exists. Logs go to `./logs` by default, or to S3, Azure, or Hugging Face buckets ([eval logs](https://inspect.aisi.org.uk/eval-logs.html)).
- **Tuning for a single GPU**: `--max-connections` (default 10), `--max-samples`, `--timeout`, `--attempt-timeout`, and `--max-retries` ([options](https://inspect.aisi.org.uk/options.html)).
- **Task library**: [UKGovernmentBEIS/inspect_evals](https://github.com/UKGovernmentBEIS/inspect_evals) (MIT, v0.29.0 on 2026-11-13). The `niah` task has the parameters `min_context`, `max_context`, `n_contexts`, `n_positions`, and `n_needles` ([niah README](https://github.com/UKGovernmentBEIS/inspect_evals/tree/main/src/inspect_evals/niah)).

## lm-evaluation-harness

Repo: [EleutherAI/lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness).

- **llama-server**: The `gguf` model type connects to llama-server through `/v1/completions` ([README](https://github.com/EleutherAI/lm-evaluation-harness#evaluating-gguf-models-served-by-llamacpp)):

  ```bash
  lm_eval --model gguf --model_args base_url=http://127.0.0.1:8080
  ```

  This type gets the parallel count from the `/props` endpoint of llama-server. This type computes exact log-likelihoods by teacher forcing, and the README says the values match the Hugging Face backend within quantization noise. Perplexity tasks (`loglikelihood_rolling`) do not work with this type. This type needs a llama.cpp release from December 2024 or newer.
- **Chat endpoints**: `local-chat-completions` supports only `generate_until`, because chat endpoints give no prompt log-probabilities ([README](https://github.com/EleutherAI/lm-evaluation-harness#model-apis-and-inference-servers)).
- **Agents**: The harness sends single requests. The harness has no tool loop.
- **Long context**: The task folder has `ruler`, `longbench`, `longbench2`, `babilong`, `infinitebench`, `scrolls`, and `longproc` ([tasks](https://github.com/EleutherAI/lm-evaluation-harness/tree/main/lm_eval/tasks)).
- **CLI**: `lm-eval run`, `lm-eval ls`, `lm-eval validate`. Options include `--apply_chat_template` and `--fewshot_as_multiturn` ([interface](https://github.com/EleutherAI/lm-evaluation-harness/blob/main/docs/interface.md)). The docs name no TUI.
- **Results**: `--output_path` writes `results_<date>.json`. `--log_samples` adds `samples_<task>_<date>.jsonl` for each task ([source](https://github.com/EleutherAI/lm-evaluation-harness/blob/main/lm_eval/loggers/evaluation_tracker.py)). The harness can push results to the Hugging Face Hub, W&B, or Zeno.
- **Activity**: The last commit on `main` is from 2026-09-14. The repo has 1,392 open issues.

## promptfoo

Repo: [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo). Docs: [promptfoo.dev](https://www.promptfoo.dev/docs/).

- **llama-server**: The `openai:chat:<model>` provider accepts `apiBaseUrl` in its config, or the `OPENAI_API_BASE_URL` and `OPENAI_BASE_URL` variables ([OpenAI provider](https://www.promptfoo.dev/docs/providers/openai/)). The separate `llama` provider calls the `/completion` endpoint of llama-server and reads `LLAMA_BASE_URL` ([llama.cpp provider](https://www.promptfoo.dev/docs/providers/llama.cpp/)).
- **Agents**: promptfoo does not run an agent loop itself. Your own Python or JavaScript provider runs the agent and returns the output ([Python provider](https://www.promptfoo.dev/docs/providers/python/)). The simulated user provider drives multi-turn conversations up to `maxTurns` (default 10) ([simulated user](https://www.promptfoo.dev/docs/providers/simulated-user/)). The `trajectory:*` assertions check tool use in a traced agent run ([assertions](https://www.promptfoo.dev/docs/configuration/expected-outputs/)).
- **Judge**: `llm-rubric`, `g-eval`, `factuality`, `model-graded-closedqa`, `select-best`, and more. The `--grader` option, or `provider` under `defaultTest.options`, sets the grader model ([model-graded](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/)).
- **Results**: `promptfoo eval --output` writes HTML, JSON, CSV, YAML, JSONL, XML, or JUnit XML. `promptfoo view` is a local web viewer ([outputs](https://www.promptfoo.dev/docs/configuration/outputs/)).
- **Focus and owner**: promptfoo is a prompt and red-team test tool in Node.js. OpenAI announced on 2026-03-09 that it will acquire Promptfoo. Promptfoo says the project "will remain open source" and will support many providers ([announcement](https://www.promptfoo.dev/blog/promptfoo-joining-openai)).

## OpenAI simple-evals

Repo: [openai/simple-evals](https://github.com/openai/simple-evals).

- **Status**: The README starts with a deprecation notice from July 2025. The repo "will no longer be updated for new models or benchmark results". The repo keeps only the reference code for HealthBench, BrowseComp, and SimpleQA. The last commit is from 2026-04-22. The repo has no releases.
- **llama-server**: `ChatCompletionSampler` creates `OpenAI()` with no base URL. Only the `OPENAI_BASE_URL` variable of the OpenAI SDK can point it at llama-server. `simple_evals.py` holds a fixed dictionary of models.
- **Agents, long context, TUI**: None.
- **Results**: JSON and HTML files in `/tmp`.
- **Use for this collection**: Read the SimpleQA and HealthBench grader prompts as reference. `inspect_evals` already has ports of `simpleqa`, `healthbench`, and `browse_comp`.

## DeepEval

Repo: [confident-ai/deepeval](https://github.com/confident-ai/deepeval). Docs: [deepeval.com](https://deepeval.com/docs/evaluation-introduction).

- **llama-server**: `deepeval set-local-model --model=<name> --base-url=<url>` or the `LOCAL_MODEL_BASE_URL` variable points the judge at each OpenAI-compatible server ([environment variables](https://deepeval.com/docs/environment-variables), [CLI settings](https://deepeval.com/docs/command-line-interface)). For benchmarks, you write a `DeepEvalBaseLLM` subclass with `generate()` for the model under test ([benchmarks](https://deepeval.com/docs/benchmarks-introduction)).
- **Agents**: DeepEval does not run agents. You add `@observe` to your own agent code. DeepEval then scores the trace end to end, by trajectory, or by component. `ConversationalTestCase` and a conversation simulator cover multi-turn chats ([evaluation](https://deepeval.com/docs/evaluation-introduction)).
- **Judge**: LLM-as-judge metrics are the core of DeepEval.
- **Long context**: No built-in task. The built-in benchmarks are BIG-Bench Hard, HellaSwag, MMLU, DROP, TruthfulQA, HumanEval, and GSM8K ([benchmarks](https://deepeval.com/docs/benchmarks-introduction)).
- **Results**: Nothing goes to disk by default. With `results_folder` or `DEEPEVAL_RESULTS_FOLDER`, each run writes `test_run_<date>.json`. `DEEPEVAL_LOCAL_STORE=sqlite` writes `deepeval.db` instead. Each run also writes `.deepeval/.latest_test_run.json`. The design pushes results to the Confident AI cloud ([flags and configs](https://deepeval.com/docs/evaluation-flags-and-configs)).
- **Telemetry**: Anonymous telemetry is on by default. Set `DEEPEVAL_TELEMETRY_OPT_OUT=1` to stop it ([environment variables](https://deepeval.com/docs/environment-variables)).

## Adopt or build

| Option | What you build | What you get |
|---|---|---|
| Adopt Inspect AI | TUI launcher, llama-server profiles, comparison reports | Agents, judge, logs, a run TUI, and about 130 ready evals in `inspect_evals` |
| Adopt lm-evaluation-harness | Agent loop, judge, TUI, reports | Exact log-likelihood on llama-server, many long-context tasks |
| Build own harness | All parts | Full control, but each feature in the table above is new work |

Inspect AI covers all rows of the ticket. The own work is the part that no candidate has: a launcher TUI for the Operator, and reports that compare models and runs.

## Effects on other tickets

- **TUI**: Inspect AI shows a Textual TUI during a run, and Textual is already a dependency. A launcher TUI in Textual adds no new framework.
- **Result storage and comparison**: The `.eval` log and the `inspect_ai.log` API can be the storage format. The run history ticket can start from these logs.
- **Gold answers from Opus 5.5**: Inspect AI writes the answer of each sample to the log. A script can copy the Opus 5.5 answers into the `target` field of a dataset. `model_graded_fact` then grades local models against these targets.
- **Long-context fill (25%, 50%, 75%, 100%)**: `niah` sets lengths in tokens (`min_context`, `max_context`, `n_contexts`). The fill levels must map to the context size that llama-server loads (`--ctx-size`). The `niah` README does not say which tokenizer counts the tokens. Check this before the spec fixes the fill levels.
- **Tool calls**: llama-server supports OpenAI-style tool calls only when it starts with `--jinja` ([llama.cpp docs](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md)). The llama-server profile of each tool or agent setup must set this flag.
- **Concurrency**: Inspect AI opens 10 connections by default. llama-server serves only as many requests in parallel as its `--parallel` slots. Set `--max-connections` to the slot count.

## Other frameworks seen

The ticket did not name these frameworks. I did not compare them in full.

- [groq/openbench](https://github.com/groq/openbench): Built on Inspect AI. MIT. Last release v0.5.3 on 2025-12-09.
- [huggingface/lighteval](https://github.com/huggingface/lighteval): MIT. Last release v0.13.0 on 2025-11-24.
