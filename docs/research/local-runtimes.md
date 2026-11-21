# Local runtimes for portable eval runs

Research for the ticket [Compare local runtimes for portable eval runs](https://github.com/a1exk-dev/llm-evals/issues/7). Sources were read on 2026-11-21.

## Question

Which local runtimes does the harness support so that evals run on any host? The ticket compares llama.cpp (`llama-server`), Ollama, vLLM, and LM Studio on 5 host classes: AMD with ROCm, AMD with Vulkan, NVIDIA, Apple Silicon, and CPU-only. For each runtime, it asks about these items:

- The OpenAI-compatible API.
- The maximum context and the KV-cache quantization.
- Tokenizer access for exact token counts.
- The settings that change results: context size, KV quantization, sampling, and seed.
- How a run records these settings.

## Answer

Use `llama-server` as the one runtime of v1. Talk to it through its OpenAI-compatible API, and use its native endpoints for token counts and for the settings record.

- `llama-server` is the only runtime of the 4 that runs on all 5 host classes from the same GGUF model file.
- `llama-server` is the only runtime of the 4 that has all 3 items over HTTP: a tokenizer endpoint, a chat-template endpoint, and a read-out of the active settings.
- The harness must start `llama-server` itself. `GET /props` does not show the KV-cache type, Flash Attention, or the device. Only the launch command holds them.
- Keep the model interface of the harness on `/v1/chat/completions`. Then a later adapter for vLLM, LM Studio, or Ollama needs only the token count and the settings record.

Do not add Ollama, vLLM, or LM Studio in v1:

- Ollama has no tokenizer endpoint. Its OpenAI API cannot set the context size, and its default context on a host with less than 24 GiB VRAM is 4k tokens.
- vLLM runs only on Linux with CUDA or ROCm, or on CPU. It uses different model files (Hugging Face weights, not GGUF), so its scores do not compare with GGUF runs of the same model.
- LM Studio wraps llama.cpp and MLX. It gives tokenization and KV-cache quantization only through its SDK, not through its REST API.

## Platform support

| Runtime | AMD with ROCm | AMD with Vulkan | NVIDIA | Apple Silicon | CPU-only |
|---|---|---|---|---|---|
| llama.cpp | Yes, HIP backend [L2] | Yes [L2] | Yes, CUDA or Vulkan [L2] | Yes, Metal is on by default [L2] | Yes, x86 and Arm [L2] |
| Ollama | Yes, RX 9070 and 9070 XT (gfx1201) on Linux [O3] | Yes, on Linux and Windows [O3] | Yes, compute capability 5.0+ [O3] | Yes, Metal [O3] | Yes [O2] |
| vLLM | Yes, RX 9000 series (gfx1200/1201), ROCm 6.3+ [V2] | No | Yes, compute capability 7.5+ [V2] | Community plugin vLLM-Metal, or experimental CPU build from source [V2] [V3] | Yes, x86 (AVX-512 recommended) and Arm [V3] |
| LM Studio | Yes, AMD 9000 series on Linux since 0.3.19 [S6] | Yes, Vulkan engine [S7] | Yes, CUDA engine [S7] | Yes, Metal and MLX [S7] | Yes [S7] |

Notes on this table:

- vLLM says: "vLLM does not support Windows natively." [V2]
- LM Studio does not support Intel Macs. On Linux, LM Studio ships as an AppImage for Ubuntu 20.04 or newer. [S3]
- LM Studio has a headless daemon, `llmster`, for Linux servers: `lms daemon up`. [S4]
- ROCm 7.2.1 supports the Radeon 9000 series (RDNA 4) on Linux. AMD names only Ubuntu and RHEL, not Arch. [R1]

## API, context, and KV cache

| Runtime | OpenAI-compatible endpoints | Context size setting | KV-cache quantization |
|---|---|---|---|
| llama.cpp | `/v1/models`, `/v1/completions`, `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`. Also Anthropic `/v1/messages`. [L1] | `-c N` at launch. `0` takes the context from the model file. [L1] | `-ctk` and `-ctv`, one type for K and one for V: `f32`, `f16`, `bf16`, `q8_0`, `q4_0`, `q4_1`, `iq4_nl`, `q5_0`, `q5_1`. Newer builds add `f8_e4m3`. Default `f16`. [L1] [H1] |
| Ollama | `/v1/chat/completions`, `/v1/completions`, `/v1/models`, `/v1/embeddings`, `/v1/responses`. [O1] | `options.num_ctx` in the native API, or `OLLAMA_CONTEXT_LENGTH` at server start. The OpenAI API cannot set it. [O1] [O2] | `OLLAMA_KV_CACHE_TYPE`: `f16`, `q8_0`, `q4_0`. Global for all models. Needs Flash Attention. [O2] |
| vLLM | `/v1/completions`, `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`. [V1] | `--max-model-len` at launch. `/tokenize` returns `max_model_len`. [V5] | `--kv-cache-dtype`: `auto`, `fp8`, `fp8_e4m3` (CUDA and ROCm), `fp8_e5m2` (CUDA). No int8 or int4 types. [V4] |
| LM Studio | `/v1/models`, `/v1/responses`, `/v1/chat/completions`, `/v1/embeddings`, `/v1/completions`. Default port 1234. [S1] | `context_length` in `POST /api/v1/models/load`, or `lms load --context-length`. [S2] [S5] | Only through the SDK: `llamaKCacheQuantizationType` and `llamaVCacheQuantizationType`. The V type needs Flash Attention. The REST load endpoint has no KV-cache field. [S2] [S8] |

The maximum context is a property of the model. Each runtime limits the context to the value that you set at load time. On a 16 GB GPU, the KV cache, not the runtime, sets the practical limit.

Ollama documents its default context in two different ways. The FAQ gives 4096 tokens [O2]. The context-length page gives a default from VRAM: 4k below 24 GiB, 32k from 24 to 48 GiB, and 256k from 48 GiB [O4]. The two sources agree on 4k for a 16 GB GPU.

Ollama also multiplies the context by `OLLAMA_NUM_PARALLEL` [O2].

## Tokenizer access

| Runtime | Exact token count before a call | Token count after a call |
|---|---|---|
| llama.cpp | `POST /tokenize` with `content`, `add_special` (default `false`), `parse_special`, and `with_pieces`. `POST /detokenize`. `POST /apply-template` returns the full prompt text after the chat template. `POST /v1/chat/completions/input_tokens` counts a chat request. [L1] | `timings.prompt_n`, `timings.cache_n`, and `timings.predicted_n`. The context use is `prompt_n + cache_n + predicted_n`. Also the `usage` object. [L1] |
| Ollama | No endpoint. The API list has no tokenize endpoint. [O5] | `prompt_eval_count` and `eval_count` in the response. [O5] |
| vLLM | `POST /tokenize` with `prompt` or `messages`, `add_special_tokens`, and `return_token_strs`. The response has `count`, `max_model_len`, `tokens`, and `token_strs`. Also `/detokenize` and `/tokenizer_info`. [V1] [V5] | `usage` object. |
| LM Studio | Only through the SDK: `model.tokenize()`, `apply_prompt_template()`, and `get_context_length()`. [S9] | `usage` object. |

For the long-context fill tests, `/tokenize` on llama.cpp and vLLM gives exact counts for the model under test. Ollama gives the count only after the model processed the prompt.

## Settings that change results

| Setting | llama.cpp | Ollama | vLLM | LM Studio |
|---|---|---|---|---|
| Context size | `-c` | `num_ctx`, `OLLAMA_CONTEXT_LENGTH` | `--max-model-len` | `context_length` |
| KV-cache type | `-ctk`, `-ctv` | `OLLAMA_KV_CACHE_TYPE` (global) | `--kv-cache-dtype` | SDK fields only |
| Flash Attention | `-fa on\|off\|auto` (default `auto`) [H1] | `OLLAMA_FLASH_ATTENTION` (auto by default) [O2] | Attention backend | `flash_attention` |
| Seed | `seed` per request. Default `-1` is random. [L1] | `options.seed` per request [O5] | `seed` per request [V6]. Server seed defaults to `0`. [V7] | `seed` per request [S10] |
| Sampling defaults | `--temp 0.80`, `--top-k 40`, `--top-p 0.95`, `--min-p 0.05`, and a sampler order. [H1] | Modelfile `PARAMETER` values | Model `generation_config.json`, unless `--generation-config vllm`. [V1] | App presets |
| Chat template | GGUF template, `--chat-template`, `--jinja` (on by default) [H1] | Modelfile template | Tokenizer template | Model template |
| Prompt cache and batching | `cache_prompt` (default `true`), `-np`, `-b`, `-ub` [L1] [H1] | `OLLAMA_NUM_PARALLEL` | Batch invariance option [V7] | `eval_batch_size` |

Two settings change results without a visible error:

- llama.cpp: "the logits are **not** guaranteed to be bit-for-bit identical for different batch sizes". Thus `cache_prompt` "can cause nondeterministic results". [L1]
- vLLM: "vLLM only provides reproducibility when it runs on the same hardware and the same vLLM version." [V7]

Thus a fixed seed gives the same output only on the same runtime build, backend, and GPU. Results from Vulkan, HIP, CUDA, and Metal will differ slightly for the same model file.

## How a run records the settings

### llama.cpp

`llama-server` exposes most settings over HTTP:

- `GET /props` returns `default_generation_settings` (with `n_ctx` and all sampling parameters), `total_slots`, `model_path`, `chat_template`, `chat_template_caps`, and `build_info`. [L1]
- `GET /slots` returns the state of each slot, with its sampling parameters. [L1]
- `POST /completion` returns `generation_settings` for each request. [L1]
- `POST /v1/chat/completions` returns `timings` for each request. [L1]

`/props` does not return the KV-cache type, Flash Attention, the device, or the batch sizes. The harness starts `llama-server` and records these values from its own launch command.

This example shows a launch command with each setting explicit:

```sh
llama-server -m model.gguf --device Vulkan0 -ngl 999 \
  -c 32768 -ctk q8_0 -ctv q8_0 -fa on -np 1 \
  --seed 42 --port 8080
```

A run record for llama.cpp holds these items:

- The runtime name and `build_info`.
- The backend and the device, from `llama-server --list-devices`.
- The model file name and its SHA-256 hash.
- The full launch command.
- The `/props` response.
- The request body of each call, with `seed`.
- The `timings` of each response.

### Ollama

- `GET /api/ps` returns `context_length` and `size_vram` of each loaded model. [O6]
- `POST /api/show` returns the model parameters, the template, and the GGUF metadata. [O5]
- The KV-cache type and Flash Attention are environment variables of the server process. The API does not return them. The harness must record the server environment.

### vLLM

The harness records the launch command, the vLLM version, and the `generation_config.json` of the model. `/tokenize` returns `max_model_len`. [V5]

### LM Studio

`POST /api/v1/models/load` with `echo_load_config: true` returns `load_config`. `load_config` holds `context_length`, `eval_batch_size`, `flash_attention`, `num_experts`, and `offload_kv_cache_to_gpu`. It has no KV-cache type. [S2]

## Facts from the first host

I examined the first host on 2026-11-21:

- The installed package is `llama-cpp 0.6.0-1`. `llama-server --version` prints `version: 0.6.0-dev (build 11429, commit d812350493)`.
- The package has only the Vulkan backend and CPU backends. It has no HIP (ROCm) backend.
- `llama-server --list-devices` shows 2 Vulkan devices: `Vulkan0: AMD Radeon RX 9070 XT (RADV GFX1201)` and `Vulkan1`, the integrated GPU of the Ryzen 7 7800X3D.
- The KV-cache types of this build do not include `f8_e4m3`. The current llama.cpp README lists `f8_e4m3`.

Consequences for the harness:

- Pin the GPU with `--device`, so that a run does not use the integrated GPU.
- Record `build_info` with each run, because the flags and the defaults change between builds.

## Points for the ticket "Decide the harness and TUI shape"

- The model interface: OpenAI chat completions plus a small runtime adapter. The adapter gives a token count, a settings record, and the start and stop of the server.
- v1 supports one runtime adapter: `llama-server`.
- The run configuration holds the launch flags of `llama-server` and the sampling values of each request.

## Sources

- [L1] llama.cpp server README: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- [L2] llama.cpp build guide: https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md
- [H1] `llama-server --help` and `llama-server --list-devices` on the first host, build 11429.
- [O1] Ollama OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility
- [O2] Ollama FAQ: https://docs.ollama.com/faq
- [O3] Ollama hardware support: https://docs.ollama.com/gpu
- [O4] Ollama context length: https://github.com/ollama/ollama/blob/main/docs/context-length.mdx
- [O5] Ollama API reference: https://github.com/ollama/ollama/blob/main/docs/api.md
- [O6] Ollama OpenAPI schema: https://github.com/ollama/ollama/blob/main/docs/openapi.yaml
- [V1] vLLM OpenAI-compatible server: https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server/ and https://docs.vllm.ai/en/latest/serving/online_serving/
- [V2] vLLM GPU installation: https://docs.vllm.ai/en/latest/getting_started/installation/gpu.html
- [V3] vLLM CPU installation: https://docs.vllm.ai/en/latest/getting_started/installation/cpu.html
- [V4] vLLM quantized KV cache: https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache.html
- [V5] vLLM tokenize protocol source: https://github.com/vllm-project/vllm/blob/main/vllm/entrypoints/serve/tokenize/protocol.py
- [V6] vLLM chat completion protocol source: https://github.com/vllm-project/vllm/blob/main/vllm/entrypoints/openai/chat_completion/protocol.py
- [V7] vLLM reproducibility: https://docs.vllm.ai/en/latest/usage/reproducibility.html
- [S1] LM Studio OpenAI compatibility: https://lmstudio.ai/docs/developer/openai-compat
- [S2] LM Studio REST load endpoint: https://lmstudio.ai/docs/developer/rest/load and https://lmstudio.ai/docs/developer/rest
- [S3] LM Studio system requirements: https://lmstudio.ai/docs/app/system-requirements
- [S4] LM Studio headless mode: https://lmstudio.ai/docs/developer/core/headless
- [S5] LM Studio `lms load`: https://lmstudio.ai/docs/cli/load
- [S6] LM Studio 0.3.19 release notes: https://lmstudio.ai/blog/lmstudio-v0.3.19
- [S7] LM Studio engines. llama.cpp variants "CPU-only, CUDA, Vulkan, ROCm, Metal": https://lmstudio.ai/blog/lmstudio-v0.3.9. MLX on Apple Silicon: https://lmstudio.ai/docs/app. CUDA 12.8 on Linux: https://lmstudio.ai/blog/lmstudio-v0.3.15
- [S8] LM Studio `LLMLoadModelConfig`: https://lmstudio.ai/docs/typescript/api-reference/llm-load-model-config
- [S9] LM Studio tokenization: https://lmstudio.ai/docs/python/tokenization
- [S10] LM Studio chat completions parameters: https://lmstudio.ai/docs/developer/openai-compat/chat-completions
- [R1] AMD ROCm Radeon Linux compatibility: https://rocm.docs.amd.com/projects/radeon/en/latest/docs/compatibility/native_linux/native_linux_compatibility.html
