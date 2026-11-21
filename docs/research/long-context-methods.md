# Long-context eval methods at a fractional context fill

Research for the ticket [Survey long-context eval methods](https://github.com/a1exk-dev/llm-evals/issues/4). Sources were read on 2026-11-21.

## Answer

Build the long-context setup on synthetic generators that take a token budget. Do not run a fixed public dataset for this setup.

- Set the fill level from the context size of the served model. Read `n_ctx` from llama-server, compute `f × n_ctx` for f = 0.25, 0.50, 0.75, 1.00, and count tokens with the model's own tokenizer through `/tokenize`.
- Take the task designs from RULER (Apache-2.0) and BABILong (Apache-2.0 code). Together they measure single-fact retrieval, multi-hop links, aggregation, and fact chains in natural text.
- Add needles with no literal match, by the NoLiMa method. Write our own needle set, because the NoLiMa data has a non-commercial research license.
- Add coreference over distance with MRCR. OpenAI publishes an MRCR dataset under MIT.
- Use plain NIAH only as a smoke test. LongBench v2 belongs in the public-benchmark setup, not in the fill setup. Fiction.LiveBench and Michelangelo have no public data.

Of the 7 methods, only RULER and BABILong build a sample to an exact token length with the model's own tokenizer. NoLiMa does the same for needle retrieval.

## Comparison

| Method | What it measures | How it sets the fill level | Tokenizer handling | Data and license | Fit for this setup |
|---|---|---|---|---|---|
| NIAH v2 (gkamradt) | Single-fact retrieval. Multi-needle and UUID-chain tasks add several facts and a simple chain. | A sweep of absolute lengths (`context_lengths: {min, max, num, scale}`) and of needle depths (`depth_percents`). | One `cl100k_base` encoding for all providers. The repo says the token count is "approximate". | Paul Graham essays. Code is MIT. | Smoke test only |
| RULER (NVIDIA) | 13 tasks: 8 NIAH variants, variable tracking (multi-hop), common-word and frequent-word extraction (aggregation), and QA on SQuAD and HotpotQA. | `--max_seq_length` per run. A binary search finds the largest haystack where input plus `tokens_to_generate` fits the length. | The model's tokenizer: `hf`, `openai` (tiktoken), `gemini`, and NeMo types. | Synthetic text, Paul Graham essays, SQuAD and HotpotQA (CC BY-SA 4.0). Code is Apache-2.0. | Primary source of task designs |
| NoLiMa (Adobe) | Retrieval with minimal lexical overlap between question and needle. One-hop and two-hop latent links. | `context_length` in tokens. 26 needle placements at equal intervals (11 at 64K and 128K). | The model's tokenizer: `huggingface`, `tiktoken`, or `google`, from the model config. | 10 open-license books, filtered for distractors. Needles and code use the Adobe Research License: non-commercial research only. | Method yes, data no |
| BABILong | bAbI tasks hidden in PG19 book text. QA1 is one fact. QA2 and QA3 chain 2 and 3 facts. QA4 and QA5 are relations. Other tasks count, list, negate. | Prebuilt splits in tokens (0k to 10M). The generator takes `sample_size` in tokens and pads with PG19 sentences. | The generator takes any Hugging Face tokenizer. The prebuilt splits do not name their tokenizer. | bAbI facts and PG19 text (Apache-2.0). Code is Apache-2.0. | Primary source of fact-chain tasks |
| LongBench v2 (THUDM) | 503 hand-made multiple-choice questions over real documents. 6 categories: single-doc QA, multi-doc QA, in-context learning, dialogue history, code repos, structured data. | No control. Each document has a fixed length of 8K to 2M words. Middle truncation cuts inputs that are too long. | The truncation uses the model's tokenizer, or tiktoken for GPT-4o. | Real documents from about 100 experts. Code is MIT. The Hugging Face dataset is Apache-2.0. | Public-benchmark setup |
| Michelangelo (Google DeepMind) | Latent List (Python list operations in code), MRCR (multi-round coreference in a long chat), IDK (questions with no answer in the text). | Subsets "up to 32K", "up to 128K", and "up to 1M" tokens, with irrelevant filler. | The paper does not name a tokenizer. | No public code or data. OpenAI MRCR (MIT) is an open version of the MRCR task. | MRCR only, from the OpenAI data |
| Fiction.LiveBench | Story understanding: changes over time, hints, secrets, subtext. | Cut-down versions of long stories, from a "0"-token version with only relevant text up to 192K. | Not published. | Stories from fiction.live users. The site says the dataset "will remain private". | Cannot run |

## How each method works

### NIAH (Needle in a Haystack)

The original test inserts one fact into Paul Graham essays and asks for the fact. Version 2 of the repo moved the settings into a YAML run file:

```yaml
sweep:
  context_lengths: {min: 2000, max: 32000, num: 8, scale: "linear"}
  depth_percents: {min: 0, max: 100, num: 11, scale: "sigmoid"}
```

- The `multi` task spreads N facts evenly through the context. The `uuid_chain` task asks for a value at the end of a chain of UUID pairs.
- Scorers are exact match or a fraction of found needles.
- `needlehaystack/core/tokens.py` uses `cl100k_base` for each provider. A Qwen or Llama model on llama-server will see a different token count than the run label.
- The RULER paper reports near-perfect vanilla NIAH scores for most models that then fail harder tasks at the same length. Thus plain NIAH shows little difference between models.

Source: [gkamradt/LLMTest_NeedleInAHaystack](https://github.com/gkamradt/LLMTest_NeedleInAHaystack), `README.md` and `needlehaystack/core/tokens.py`.

### RULER

RULER evaluates 17 models on 13 tasks. The paper reports that "only half of them can maintain satisfactory performance at the length of 32K", although each model claims 32K or more.

Task groups in `scripts/config_tasks.sh`:

| Group | Tasks | What the task asks |
|---|---|---|
| Retrieval | `niah_single_1..3`, `niah_multikey_1..3`, `niah_multivalue`, `niah_multiquery` | Find one or more values, with distractor keys. |
| Multi-hop tracing | `vt` | Follow a chain of variable assignments to find all names with one value. |
| Aggregation | `cwe`, `fwe` | List the most common or most frequent words in the context. |
| Question answering | `qa_1` (SQuAD), `qa_2` (HotpotQA) | Answer from one gold paragraph among distractor paragraphs. |

How RULER sets the length:

- `scripts/data/synthetic/niah.py` subtracts the chat template tokens from `max_seq_length`.
- The script then does a binary search on the number of haystack units. The script keeps the largest count where `len(TOKENIZER.text_to_tokens(input_text)) + tokens_to_generate <= max_seq_length`.
- Thus each sample fills the window to a known fraction when you set `max_seq_length = f × n_ctx`.
- `run.sh` uses `NUM_SAMPLES=500` per task and length, and greedy decoding.

Limits for this project:

- The README marks the `main` pipeline as deprecated. The `rulerv2-ns` branch runs through NeMo-Skills with vLLM, SGLang, or TensorRT-LLM. Neither pipeline supports llama-server.
- The data generators are standalone Python and Apache-2.0. We can port the generators and replace the tokenizer class with a call to llama-server `/tokenize`.

Sources: [NVIDIA/RULER](https://github.com/NVIDIA/RULER), [arXiv 2404.06654](https://arxiv.org/abs/2404.06654), [`rulerv2-ns` README](https://github.com/NVIDIA/RULER/tree/rulerv2-ns).

### NoLiMa

NoLiMa removes the literal match between the question and the needle. Example needle: "Actually, Yuki lives next to the Semper Opera House." Question: "Which character has been to Dresden?" The two-hop version asks about "the state of Saxony".

- The needle set has 58 question-needle pairs. Each test runs on 5 haystacks with 26 placements, so 7,540 tests for each length.
- The base score is the best score at 250, 500, or 1K tokens. The effective length is the largest length where the score stays above 85% of the base score.
- At 32K, 11 of 13 models fall to half of their base score or less. GPT-4o falls from 99.3 to 69.7.
- When multiple-choice options bring the literal match back, Llama 3.3 70B rises from 56.2 to 93.1 at 32K on one-hop tasks. The authors conclude that attention fails in long contexts when no literal match exists.
- `evaluation/async_evaluate.py` passes the token count, encode, and decode functions of the model's tokenizer to `BookHaystack`. The haystack is cut to `context_length` tokens of that tokenizer.

License: the `LICENSE` file is the Adobe Research License. Clause 1.3 says that non-commercial research "include[s] academic research and teaching only". A personal eval collection is not clearly in that scope. Do not copy the NoLiMa needles or haystacks into this repo. A new needle set with the same design avoids the problem.

Sources: [adobe-research/NoLiMa](https://github.com/adobe-research/NoLiMa), [arXiv 2502.05167](https://arxiv.org/abs/2502.05167), [Hugging Face amodaresi/NoLiMa](https://huggingface.co/datasets/amodaresi/NoLiMa).

### BABILong

BABILong hides the sentences of bAbI tasks between PG19 book sentences. The order of the PG19 sentences stays natural.

| Task | Name | Supporting facts |
|---|---|---|
| qa1 | single supporting fact | 1 |
| qa2 | two supporting facts | 2 |
| qa3 | three supporting facts | 3 |
| qa4 | two arg relations | 1 |
| qa5 | three arg relations | 1 |

- The paper reports that popular LLMs "effectively utilize only 10-20% of the context". The leaderboard reports the average of QA1 to QA5.
- `RMT-team/babilong` has 100 samples for each task and length. `RMT-team/babilong-1k-samples` has 1,000 samples up to 128K.
- `babilong/babilong_utils.py` builds a sample with `NoiseInjectionDataset(task_dataset, noise_sampler, tokenizer, sample_size=...)`. The `tokenizer` argument is any Hugging Face tokenizer, so we can build samples at `f × n_ctx` tokens of the model under test.
- The repo already has scripts for llama.cpp, for example `scripts/run_Yarn-Mistral-7b-128k_llamacpp_with_instruct.sh`. These scripts call `http://localhost:8082/completion`.
- The README gives bAbI the BSD license. The Hugging Face card of `facebook/babi_qa` gives CC BY 3.0. Both licenses permit our use with attribution.

Sources: [booydar/babilong](https://github.com/booydar/babilong), [arXiv 2406.10149](https://arxiv.org/abs/2406.10149), [Hugging Face RMT-team/babilong](https://huggingface.co/datasets/RMT-team/babilong).

### LongBench v2

LongBench v2 has 503 multiple-choice questions. Annotators wrote the questions, and LLM and human reviews removed easy questions. Human experts score 53.7% in 15 minutes.

- Length groups by words: Short (<32K, 180 questions), Medium (32K to 128K, 215), Long (>128K, 108). The median is 54K words.
- `pred.py` cuts each prompt to `max_len` tokens. The script keeps the first half and the last half (`input_ids[:max_len//2] + input_ids[-max_len//2:]`).
- Middle truncation can delete the evidence for the answer. Thus a score at "25% fill" measures a damaged document, not retrieval at 25% fill.
- Most documents are longer than the windows that fit on a 16 GB GPU.

Sources: [THUDM/LongBench](https://github.com/THUDM/LongBench), [arXiv 2412.15204](https://arxiv.org/abs/2412.15204), [Hugging Face zai-org/LongBench-v2](https://huggingface.co/datasets/zai-org/LongBench-v2).

### Michelangelo and MRCR

Michelangelo defines Latent Structure Queries: the model must remove the irrelevant text and report details of a hidden structure. The paper reports that "all models experience significant fall off in performance before 32K".

- Latent List: a Python list, many operations on the list, and filler such as `print('Do nothing.')`. The model reports a view of the final list.
- MRCR: a long chat with many writing requests. The model must reproduce one specific earlier answer.
- IDK: a text and a multiple-choice question. "I don't know" is correct in 70% of instances.
- The paper links no code and no data.

OpenAI MRCR is an open version of the MRCR task under MIT:

- Each chat hides 2, 4, or 8 identical requests. The final prompt asks for, for example, "the 2nd poem about tapirs".
- The score is the `difflib.SequenceMatcher` ratio. A missing hash prefix gives 0.
- Bins use `o200k_base` token counts: [4096, 8192], (8192, 16384], up to 1M. Each bin has 100 samples.
- On 2025-12-05 OpenAI fixed about 10% of samples with too many needles and about 5% with a wrong answer.
- For a fill level, count each sample with the model's tokenizer and keep the samples nearest to `f × n_ctx`. The bins do not give exact fill levels.

Sources: [arXiv 2409.12640](https://arxiv.org/abs/2409.12640), [Hugging Face openai/mrcr](https://huggingface.co/datasets/openai/mrcr).

### Fiction.LiveBench

Fiction.LiveBench asks hard questions about long stories. The questions test subtext, so a search for one passage does not find the answer.

- Each test starts as a cut-down story with only the relevant text, the "0"-token test. Longer tests cut less of the story.
- The launch post says: "The actual dataset comes from our users and will remain private."
- We cannot run Fiction.LiveBench on a local model. Only the leaderboard is public.

Source: [Fiction.LiveBench launch post](https://fiction.live/stories/Fiction-liveBench-Feb-21-2025/oQdzQvKHw8JyXbN87), read through the fiction.live chapter API.

## How to set the fill level on any host

All four fill levels refer to the context size that the server loaded, not to the training length of the model.

1. Read `n_ctx` from llama-server (`/props` or `/slots`).
2. For each fill f, compute the budget: `f × n_ctx` minus the chat template tokens and minus the output budget (`tokens_to_generate`).
3. Render the chat template with `/apply-template`. Count tokens with `/tokenize`. Both endpoints use the model's own tokenizer.
4. Add filler units in a binary search until the prompt is the largest that fits the budget, as RULER does.
5. Record the actual token count of each sample next to the score.

```bash
curl -s http://localhost:8080/tokenize -d '{"content": "Mary travelled to the office."}'
```

For an online model later, use the token-count endpoint of the provider. llama-server also implements `/v1/messages/count_tokens`.

## Cost on a 16 GB GPU

### Memory

The KV cache grows linearly with `n_ctx`. For each token, the KV cache needs `2 × layers × kv_heads × head_dim × bytes`.

Example: Qwen2.5-7B-Instruct has 28 layers, 4 KV heads, and a head size of 128 (`config.json`).

| `n_ctx` | KV cache, f16 | KV cache, q8_0 | Weights, Q4_K_M |
|---|---|---|---|
| 32,768 | 1.75 GiB | about 0.9 GiB | 4.4 GiB |
| 131,072 | 7 GiB | about 3.7 GiB | 4.4 GiB |

The weights size comes from the `llama-bench` README example (4,677,120,000 bytes). Qwen2.5-7B at 128K fits on 16 GB with an f16 KV cache. Its native length is 32,768 (`max_position_embeddings`), so 128K needs YaRN scaling.

The KV cache size changes much between models. Llama 3.1 8B has 32 layers and 8 KV heads (`config.json`), so its f16 KV cache needs 16 GiB at 128K. That model needs `-ctk q8_0 -ctv q8_0` or a smaller `n_ctx` on a 16 GB GPU. Compute the KV cache size from `config.json` for each model before you select `n_ctx`.

### Time

Prompt processing takes most of the time, because each sample is new text. The number of prompt tokens for one run is:

```
prompt tokens = samples per task × tasks × n_ctx × (0.25 + 0.50 + 0.75 + 1.00)
```

Example: 50 samples, 8 tasks, `n_ctx = 32768` gives 32.8M prompt tokens. At an average of 2,000 tokens per second, the run takes about 4.6 hours. This speed is an assumption. Measure the real speed at depth with `llama-bench -d <n>`, which fills the KV cache with `<n>` tokens before the test.

RULER uses 500 samples for each task and length, and NoLiMa uses 7,540 tests for each length. Both numbers are too large for one local GPU. Use 25 to 100 samples for each task and fill level, and report a confidence interval.

llama-server has `cache_prompt` on by default. Samples that share a haystack prefix reuse the KV cache, but the README warns that the results are then not bit-for-bit deterministic.

## Effect on other tickets

- The public-benchmark ticket can take LongBench v2. Its long documents need a window larger than a 16 GB GPU gives to most models.
- NoLiMa data cannot go into this repo under its license. Any setup that redistributes data needs a license check.
- Fiction.LiveBench and Michelangelo cannot be part of v1, because their data is not public.
