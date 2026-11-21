# AGENTS.md

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (a1exk-dev/llm-evals) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Multi-context: one context per topic under `evals/<topic>/` (own `GLOSSARY.md` + `docs/adr/`), indexed by root `GLOSSARY-MAP.md`. See `docs/agents/domain.md`.

### Auto-merge

`develop` has no required checks yet. When `gh pr merge --auto` fails with "Pull request is in clean status", run the same `gh pr merge` command without `--auto`. This rule is applicable only when the Semver policy has the auto-merge Setting `on` for the base branch.

# Human communication

- Before you write text that a human reads (chat messages, questions, reports, code comments, and documents for persons), use the Skill tool with the human-communication Skill. If your platform has no Skill tool, read its SKILL.md.
