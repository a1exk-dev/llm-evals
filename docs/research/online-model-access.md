# Access paths for online models

Research for the ticket [Compare access paths for online models](https://github.com/a1exk-dev/llm-evals/issues/6). Sources were read on 2026-11-21. Each claim links to the page that owns it.

## Answer

Call Claude Opus 5.5 directly through the Anthropic Messages API, with an API key from the Claude Console. Set `output_config.effort: "medium"` on each request. Send single-turn tasks through the Message Batches API at half price. Send multi-turn and tool-call tasks as streaming requests.

Do not use the Claude Code CLI (`claude -p`) for the reference run. Claude Code is an agent harness. It adds its own prompt and tools, it reports only an estimated cost, and the Claude subscription limits assume ordinary individual use.

Use OpenCode for other models only through its Console inference API. That API is a plain gateway with OpenAI-compatible, Anthropic-compatible, and Gemini-compatible endpoints, and each response reports the cost. Use `opencode run` only for an eval that measures the OpenCode agent itself, because the agent adds its own instructions to each prompt.

## Comparison

| Criterion | Anthropic Messages API | Claude Code CLI (`claude -p`) | OpenCode |
|---|---|---|---|
| Effort | `output_config.effort`, levels `low` to `max`. | `--effort` flag or `CLAUDE_CODE_EFFORT_LEVEL`. | Model variant (`provider/model#variant`) or `settings.reasoningEffort`. The mapping depends on the provider package. |
| Sampling | None. `temperature`, `top_p`, and `top_k` return a 400 error on API version `2026-10-21`. | None (same API). | Depends on the model. OpenCode can send provider body fields, for example `temperature`. |
| Raw model call | Yes. | No. Claude Code adds its system prompt and tools unless you replace them. | Console inference API: yes. `opencode run`: no, the agent adds instructions. |
| Token counts | `usage` with input, output, cache read, cache write, and `thinking_tokens`. | `usage` and `modelUsage` in the JSON result. | Console API: `usage.opencode.tokens` with input, output, reasoning, cache. `opencode run`: `tokens` on each assistant message. |
| Latency | Measure on the client. Streaming gives time to first token. | `duration_ms`, `duration_api_ms`, `ttft_ms` in the result. | `time.created`, `time.firstToken`, `time.completed` on each assistant message. |
| Cost | List price, billed from `usage`. Batch: 50% off. | `total_cost_usd` is a client-side estimate. | Console API: `usage.cost` is the amount charged. |
| Rate limits | Per tier. Opus 5.5 Start tier: 4,000 RPM, 2,000,000 ITPM, 400,000 OTPM. Monthly spend cap: $500. | API key: API limits. Subscription: plan limits. | Console: no general limits published. Go: 5-hour, weekly, and monthly allowance. |
| Repeatability | Model ID is a fixed snapshot. Output is not deterministic. | Same as the API, plus Claude Code version changes. | Depends on the upstream provider, plus OpenCode version changes. |
| Tool calls | Client tools, server tools, strict tools. Forced `tool_choice` returns a 400 error on Opus 5.5. | Built-in tools, MCP servers. | Agent tools in `opencode run`. Native tool calls through the Console API. |
| Terms for automated evals | Permitted with an API key under the Commercial Terms. | API key: permitted. Subscription: limits assume ordinary individual use. | Unclear. See [OpenCode terms](#opencode-terms). |

## Anthropic Messages API

### Effort and thinking

- Opus 5.5 supports the effort levels `low`, `medium`, `high`, `xhigh`, and `max`. The default is `medium`. Sending `medium` gives the same behavior as no value. ([Effort](https://platform.claude.com/docs/en/build-with-claude/effort))
- Set the level in `output_config.effort`:

  ```json
  {
    "model": "claude-opus-5-5",
    "max_tokens": 64000,
    "output_config": { "effort": "medium" },
    "messages": [{ "role": "user", "content": "..." }]
  }
  ```

- Adaptive thinking is always on for Opus 5.5. `thinking: {"type": "disabled"}` and `budget_tokens` return a 400 error. Thinking tokens count toward `max_tokens`. ([What's new in Claude Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5))
- Set the effort explicitly in the harness. The default differs between models: Opus 5.5 and Haiku 5.5 default to `medium`, other models default to `high`. ([Effort](https://platform.claude.com/docs/en/build-with-claude/effort))

### Sampling and repeatability

- API version `2026-10-21` removes `temperature`, `top_p`, and `top_k`. A request with any of them returns a 400 error on every model. ([API versions](https://platform.claude.com/docs/en/api/versioning)) The Messages API has no `seed` parameter. ([Create a Message](https://platform.claude.com/docs/en/api/messages/create))
- Thus the harness cannot make Opus 5.5 output deterministic. To measure variance, run each task more than one time. Store the gold answers as fixed files and do not generate them again for each run.
- The model ID `claude-opus-5-5` identifies one fixed snapshot. Anthropic does not change the weights of a model ID. The serving infrastructure, for example the router, the safety classifiers, and the sampling logic, can change and cause small differences. ([Model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions))
- Opus 5.5 can stop with `stop_reason: "refusal"` (HTTP 200) when a safety classifier declines the request. The server-side `fallbacks` parameter retries on a different model. ([What's new in Claude Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5)) For the reference run, do not send `fallbacks`, because a fallback answer comes from a different model. Record each refusal as a result.

### Token counts and latency

- Each response has a `usage` object with `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens_details.thinking_tokens`, `server_tool_use`, `service_tier`, `speed`, and `inference_geo`. `output_tokens` includes the thinking tokens. ([Create a Message](https://platform.claude.com/docs/en/api/messages/create))
- With caching, total input is `cache_read_input_tokens + cache_creation_input_tokens + input_tokens`. ([Rate limits](https://platform.claude.com/docs/en/api/rate-limits))
- The `count_tokens` endpoint counts input tokens before a request. It is free, with its own rate limit (Start tier: 5,000 RPM). The count is an estimate. ([Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting))
- The response has no latency field. The harness measures wall time on the client. With streaming, the harness also measures time to first token.

### Cost

| Item | Opus 5.5 price per million tokens |
|---|---|
| Input | $4 |
| Output (includes thinking) | $20 |
| 5-minute cache write | $5 |
| 1-hour cache write | $8 |
| Cache read | $0.20 |
| Batch input / output | $2 / $10 |

Source: [Pricing](https://platform.claude.com/docs/en/about-claude/pricing).

- Opus 5.5 has no long-context surcharge. A 900k-token request has the same price per token as a 9k-token request. ([Pricing](https://platform.claude.com/docs/en/about-claude/pricing)) Thus one long-context task at the full 1M window costs about $4 of input.
- Example: 1,000 tasks with 2,000 input tokens and 3,000 output tokens each cost $8 + $60 = $68. Through the Batch API, they cost $34. These numbers are an example only. The real output length at `medium` effort is not known before a run.
- Fast mode (`speed: "fast"`) costs 2x and is not available in the Batch API. ([Pricing](https://platform.claude.com/docs/en/about-claude/pricing)) The reference run does not need fast mode.

### Rate limits and spend caps

| Tier | Opus 5.5 RPM | ITPM | OTPM | Monthly spend cap |
|---|---|---|---|---|
| Start | 4,000 | 2,000,000 | 400,000 | $500 |
| Build | 10,000 | 5,000,000 | 1,000,000 | $1,000 |
| Scale | 13,000 | 10,000,000 | 2,000,000 | $200,000 |

Source: [Rate limits](https://platform.claude.com/docs/en/api/rate-limits).

- New organizations can start in an Evaluation tier with lower limits.
- Cache reads do not count toward ITPM.
- A ramp limit returns 429 (`ramp_limit_exceeded`) after a sharp increase in usage, also below the tier limits. Start a run at a low rate and increase it slowly. The Batch API has no ramp limit.
- At the spend cap, the API returns 429 (`enforced_spend_limit_reached`) with no `retry-after` header until the next month.

### Message Batches API

- Most batches finish in less than 1 hour. A batch expires after 24 hours. The results stay available for 29 days. The results can come back in a different order, so key them by `custom_id`. ([Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing))
- A batch request can contain tool definitions, a system prompt, and multi-turn history. Each batch request is one model call. Thus an agentic loop that runs tools between calls needs synchronous requests.
- A batch request cannot use `stream`, `speed`, `fallbacks`, or `max_tokens: 0`.
- The Batch API is not eligible for zero data retention (29-day retention).

### Tool calls and JSON

- Opus 5.5 supports client tools, server tools, and strict tool use. `tool_choice` `{"type": "any"}` and `{"type": "tool"}` return a 400 error. Use `auto` with `strict: true`, or structured outputs (`output_config.format`). ([What's new in Claude Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5))
- Each tool request adds 286 tokens of tool system prompt on Opus 5.5. ([Pricing](https://platform.claude.com/docs/en/about-claude/pricing))

### Terms

- The Commercial Terms apply to Claude API users. They prohibit use of the Services to build a competing product or to train competing AI models. They have no clause about benchmarks or automated access. ([Commercial Terms](https://www.anthropic.com/legal/commercial-terms), [Claude Code legal and compliance](https://code.claude.com/docs/en/legal-and-compliance))
- Do not train a model on the gold answers. A personal eval collection that scores models does not train a model.

## Claude Code CLI (`claude -p`)

### What it controls

These flags of `claude -p` are relevant to scripted runs ([CLI reference](https://code.claude.com/docs/en/cli-reference)):

```bash
claude --bare -p "<prompt>" \
  --model claude-opus-5-5 \
  --effort medium \
  --system-prompt-file ./prompt.txt \
  --tools "" \
  --output-format json \
  --no-session-persistence
```

- `--bare` skips hooks, skills, plugins, MCP servers, auto memory, and `CLAUDE.md`. In bare mode, Claude Code reads no OAuth credentials, so it needs `ANTHROPIC_API_KEY`. ([Run Claude Code programmatically](https://code.claude.com/docs/en/headless))
- `--system-prompt` and `--system-prompt-file` replace the default system prompt. `--tools ""` removes all built-in tools. `--max-turns` and `--max-budget-usd` stop a run.
- Opus 5.5 starts at `medium` effort in Claude Code. `CLAUDE_CODE_EFFORT_LEVEL` has priority over `--effort`. ([Model configuration](https://code.claude.com/docs/en/model-config))
- Claude Code gives no sampling control, because the API has none.

### What it reports

- `--output-format json` gives a result with `duration_ms`, `duration_api_ms`, `ttft_ms`, `num_turns`, `stop_reason`, `total_cost_usd`, `usage`, and `modelUsage`. ([Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript))
- `total_cost_usd` and `costUSD` are client-side estimates from a price table in the Claude Code build. They can differ from the bill. ([Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking))
- `usage` excludes subagent tokens. `modelUsage` includes them.

### Why it does not fit the reference run

- Claude Code is an agent harness. Even with a replaced system prompt, the request is not the same as a plain Messages API request. The baseline scores and gold answers are then for "Opus 5.5 in Claude Code", not for "Opus 5.5".
- The Consumer Terms (Free, Pro, Max, Ultra) prohibit access "through automated or non-human means, whether through a bot, script, or otherwise", except with an API key or where Anthropic explicitly permits it. ([Consumer Terms](https://www.anthropic.com/legal/consumer-terms))
- Claude Code says that the advertised Pro, Max, and Ultra limits "assume ordinary, individual usage of Claude Code and the Agent SDK". ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)) A bulk eval run is not ordinary individual use.
- With an API key, `claude -p` has the same cost and limits as the API, but less control. Thus the API is the better path.

### When it fits

Use `claude -p --bare` with an API key only for an eval that measures Claude Code as an agent, for example an agentic coding test.

## OpenCode

OpenCode v2 has two access paths. The OpenCode agent runs on the host and calls a provider. The OpenCode Console sells model access ("OpenCode Models", earlier "Zen") and the Go subscription.

### OpenCode agent (`opencode run`)

- `opencode run --model provider/model#variant --format json "<prompt>"` sends one message and prints newline-delimited JSON. Other flags: `--agent`, `--file`, `--session`, `--archived`, `--auto`, `--standalone`. (`opencode run --help`, v2.3.2; [CLI commands](https://opencode.ai/docs/cli/commands/))
- Effort: select a variant with `#variant`, or set `settings.reasoningEffort`. Variant names come from the models.dev catalog. An unknown name causes an error. ([Models](https://opencode.ai/docs/models/))
- Sampling: OpenCode sends provider body fields, for example `"body": { "temperature": 0.1 }`. Each model declares in `capabilities` whether it supports `temperature`. ([Agents](https://opencode.ai/docs/agents/), [Providers](https://opencode.ai/docs/providers/))
- Token counts and latency: each assistant message has `tokens` (`input`, `output`, `reasoning`, `cache.read`, `cache.write`), `cost`, and `time` (`created`, `firstToken`, `streamed`, `completed`). (OpenAPI schema `Session.Message.Assistant` at `https://opencode.ai/docs/openapi.json`) `opencode stats --cost --json` gives totals.
- An agent `system` prompt replaces the base prompt of the provider. OpenCode still adds project instructions, skills, references, and other instruction sources. ([Agents](https://opencode.ai/docs/agents/)) Thus `opencode run` is not a raw model call.

### OpenCode Console inference API

- Endpoints under `https://opencode.ai/inference`: OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, and Gemini. Authentication: `Authorization: Bearer <Console API key>`. ([Inference API](https://opencode.ai/docs/console/api/inference/))
- Each response reports `usage.cost` (US dollars charged) and `usage.opencode.tokens` (`input`, `output`, `reasoning`, `cache_read`, `cache_write_5m`, `cache_write_1h`). ([Inference API](https://opencode.ai/docs/console/api/inference/))
- Free chat models work only inside OpenCode. Other clients receive HTTP 403.
- Prices: per request, from credits. A credit purchase has a fee of 4.6% + $0.31. Example: Claude Opus 5 costs $5 / $25 per million tokens, the same as the Anthropic list price. ([OpenCode Console models](https://opencode.ai/docs/console/models/))
- Data retention: Anthropic and OpenAI requests 30 days, Google up to 55 days. Some free models can use data for training.
- The Console publishes no general rate limits.

### OpenCode Go

- Go costs $10 per month, Go Plus $40 per month. The 5-hour limit is 20% and the weekly limit is 50% of the monthly allowance. ([Go](https://opencode.ai/docs/console/go/))
- Go "is designed for OpenCode and other coding agents that produce similar types of requests. Traffic is monitored for abuse." An eval run does not send typical coding agent traffic. Thus a large eval run on Go can trigger the abuse monitor.

### ChatGPT sign-in

OpenCode can use a ChatGPT Plus or Pro plan in place of an OpenAI API key. Usage counts against the plan, and OpenCode shows no cost. ([Providers](https://opencode.ai/docs/providers/)) This research did not read the OpenAI terms for automated use of a ChatGPT plan.

### OpenCode terms

The [OpenCode Terms of Use](https://opencode.ai/legal/terms-of-service) (effective 2026-11-08) prohibit use that:

- "automatically or programmatically extracts data or Output" (item 5),
- "uses Output to develop artificial intelligence models that compete with the Services or any Third Party Models" (item 7),
- runs "processes that run or are activated while you are not logged into the Services" (item 10).

The same company documents a scripted inference API and `opencode run` for CI. Thus the terms and the docs do not agree. Before a large automated run through the Console or Go, ask OpenCode support (help@anoma.ly) for written confirmation. With your own provider key, the terms of that provider apply to the model calls.

## Recommendation for the harness

1. Give the harness one adapter for the Anthropic Messages API (official SDK) and one adapter for OpenAI-compatible Chat Completions. The second adapter covers `llama-server`, the OpenCode Console, and most other gateways.
2. For the reference run, use an Anthropic API key. Set `model: claude-opus-5-5` and `output_config.effort: medium` explicitly. Send no sampling parameters and no `fallbacks`.
3. Send single-turn tasks through the Message Batches API. Send multi-turn and tool tasks as streaming requests, and measure time to first token on the client.
4. Store for each request: the model ID, the effort, the full `usage` object, `stop_reason`, the wall time, the time to first token, and the API version.
5. Run each task more than one time to measure variance, because the output is not deterministic.
6. Before the reference run, set a workspace spend limit in the Claude Console below the tier cap.

## Open questions

- Which OpenCode access does the Operator have: Console credits, Go, ChatGPT sign-in, or provider keys? The answer decides the gateway adapter and the terms that apply.
- Does OpenCode confirm that scripted eval runs through the Console API agree with items 5 and 10 of its terms?
- What is the Anthropic usage tier of the Operator's organization? The tier decides the spend cap and the concurrency of the run.
