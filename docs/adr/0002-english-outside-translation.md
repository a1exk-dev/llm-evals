# Only translation uses 4 languages

Only translation uses en, de, pl, and ru: the language topic and the Email reply pipeline of the agents topic. All other evals use English. The Operator decided this rule for all topics in "Design the agentic pipelines" (https://github.com/a1exk-dev/llm-evals/issues/9).

## Consequences

- Each check outside translation needs gold answers and patterns in one language only.
- IFEval, MMLU-Pro, GPQA, the long-context tasks, and the other agents pipelines use English.
- v1 does not measure how well a model obeys instructions, answers questions, or uses tools in de, pl, or ru.
- The spam and phishing emails of the Inbox triage pipeline are English. Public sets have almost no real spam or phishing in de and ru.
