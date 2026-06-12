# Security Policy

## Supported Versions

This project is pre-1.0. Security fixes target the latest `main` branch unless a release branch is created later.

## Reporting a Vulnerability

Please do not publish exploit details in a public issue.

Preferred path:

1. Use GitHub private vulnerability reporting if it is enabled for this repository.
2. If private reporting is not available, open a minimal public issue asking for a security contact. Do not include exploit details, tokens, private file contents, or generated private knowledge.

Helpful details:

- affected command or workflow
- impact
- reproduction steps with sanitized data
- whether secrets, local files, generated knowledge, or remote API calls are involved

## Scope

High-priority reports include:

- leaking `.env.local`, API keys, or tokens
- writing generated private knowledge into committed files
- unsafe file reads outside the configured knowledge root
- command injection in CLI arguments
- untrusted repository content being executed as code
- LLM prompts that expose secrets or private source snapshots

Out of scope:

- GitHub API rate limits
- broad prompt-injection concerns without a concrete exploit path
- issues requiring access to a contributor's local secrets
