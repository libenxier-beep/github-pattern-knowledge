# Codex Skill Reference

The reusable Codex skill for operating this project lives in:

https://github.com/libenxier-beep/codex-skills/tree/main/skills/github-engineering-pattern-knowledge

The skill is an optional discovery and routing adapter for manual requests. It points an agent to this repository and its canonical documents; it is not the runbook or policy authority.

## Why This Repo References The Skill

This repository owns the workflow so scheduled runs, manual runs, tests, and maintainers share one contract:

- `REPOSITORY.md` owns repository purpose and lifecycle boundaries.
- `docs/daily-workflow.md` owns phase order, handoffs, and stop behavior.
- `docs/human-report-quality-standard.md` owns the positive report contract.
- `src/`, `tests/`, and `src/harness/` own deterministic acceptance and publication safety.

The skill should remain small enough to delete later without moving policy: it owns only trigger metadata, non-trigger boundaries, and links to these sources. It may be removed when every supported caller can locate the repository and its workflow without skill discovery; no workflow rule should need migration at that point.

The knowledge base remains a Work Contexts asset by default. The website repo should not commit `.env.local`, `node_modules`, `dist`, or private generated knowledge data.
