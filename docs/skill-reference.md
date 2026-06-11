# Codex Skill Reference

The reusable Codex skill for operating this project lives in:

https://github.com/libenxier-beep/codex-skills/tree/main/skills/github-engineering-pattern-knowledge

Use that skill when building, running, auditing, or extending this repository and its Work Contexts knowledge base.

## Why This Repo References The Skill

This repository contains the TypeScript tool and local dashboard. The skill contains the agent-facing operating procedure:

- how to run seed and daily ingestion
- how to avoid re-learning repositories already recorded in `registry/learned_repos.json`
- how to keep human-facing cards separate from agent-readable pattern notes
- how to maintain retrieval tags, indexes, progressive disclosure, and harness validation
- how to avoid publishing secrets or private generated knowledge data

The knowledge base remains a Work Contexts asset by default. The website repo should not commit `.env.local`, `node_modules`, `dist`, or private generated knowledge data.
