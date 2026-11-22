# Fill levels are absolute token lengths

The fill levels are 32,768, 65,536, 98,304, and 131,072 tokens for each model. These lengths are 25% to 100% of one standard window of 131,072 tokens. The Operator did not select a percentage of the window of each model. With a percentage, 2 models at "50%" get prompts of different lengths, and their scores do not compare. A model runs only the fill levels up to its native maximum, with no RoPE or YaRN scaling. The score then measures the model, not a context extension. The Operator decided this in "Define context fill and the long-context tasks" (https://github.com/a1exk-dev/llm-evals/issues/10).

## Considered options

- A percentage of the `n_ctx` that the run loads. The research ticket recommended this option. Scores compare only between runs with the same `n_ctx`.
- A percentage of the advertised maximum. On 16 GB of VRAM, many models cannot load the 100% fill.
- 131,072 tokens for each model with the YaRN settings of the model card. The Operator selected the native maximum only.

## Consequences

- A model with a native maximum of 32,768 tokens runs only the first fill level. A model with a native maximum below 32,768 tokens gets "not supported" in this topic.
- The harness starts `llama-server` again for each fill level, with `n_ctx` equal to the fill level. A CPU offload at 131,072 tokens then does not slow the 32,768 level.
- The prompts of 2 models differ a little, because each model counts tokens with its own tokenizer. The coreference task uses the same MRCR samples for all models.
