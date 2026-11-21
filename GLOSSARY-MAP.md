# Glossary Map

A topic is one group of evals that test one capability of a model. Each topic is one context, in its own folder `evals/<topic>/`. A topic holds its public benchmarks and its own tasks. The `domain-modeling` skill makes the `GLOSSARY.md` of a topic when the Operator and an agent agree on the first term of that topic.

## Contexts

- [language](./evals/language/GLOSSARY.md): translation between en, de, pl, and ru
- [coding](./evals/coding/GLOSSARY.md): write code, debug, and test
- [knowledge](./evals/knowledge/GLOSSARY.md): facts, reasoning, and hallucination checks
- [instructions](./evals/instructions/GLOSSARY.md): obey format rules and JSON schemas
- [agents](./evals/agents/GLOSSARY.md): tool calls and non-coding pipelines
- [long-context](./evals/long-context/GLOSSARY.md): find and connect facts at a context fill of 25%, 50%, 75%, and 100%

## Relationships

- **All topics**: code makes each score, with no judge model. See `docs/adr/0001-deterministic-scoring.md`.
- **language → agents**: the agents pipelines use the languages of the language topic.
