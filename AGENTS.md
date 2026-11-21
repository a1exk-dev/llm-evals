# AGENTS.md

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (a1exk-dev/llm-evals) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Multi-context: one context per eval setup under `evals/<setup>/` (own `GLOSSARY.md` + `docs/adr/`), indexed by root `GLOSSARY-MAP.md`. See `docs/agents/domain.md`.

# Human communication

- Before you write text that a human reads (chat messages, questions, reports, code comments, and documents for persons), use the Skill tool with the human-communication Skill. If your platform has no Skill tool, read its SKILL.md.
