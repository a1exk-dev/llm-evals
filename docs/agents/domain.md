# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root, or
- **`GLOSSARY-MAP.md`** at the repo root if it exists: it points at one `GLOSSARY.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. Also check `evals/<setup>/docs/adr/` for decisions scoped to an eval setup.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is **multi-context**: one context per eval setup, each in its own folder under `evals/`. `GLOSSARY-MAP.md` at the root lists the contexts and points at each one's `GLOSSARY.md`.

```
/
├── GLOSSARY-MAP.md                    ← index of contexts
├── docs/adr/                          ← repo-wide decisions (shared harness, tooling)
└── evals/
    ├── <setup-a>/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← decisions for this eval setup
    └── <setup-b>/
        ├── GLOSSARY.md
        └── docs/adr/
```

When working inside `evals/<setup>/`, read that setup's `GLOSSARY.md` and `docs/adr/`, plus the root `docs/adr/`. A term may mean different things in different setups; don't carry definitions across contexts unless `GLOSSARY-MAP.md` says they're shared.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
