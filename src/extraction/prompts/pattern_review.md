# Pattern Review Prompt

Review extracted engineering patterns against the same commit-pinned evidence pack used for extraction.

Rules:

- Accept only patterns that are directly supported by source evidence.
- Reject generic architecture praise, over-abstracted labels, and claims that cannot be reopened in the stored source snapshot.
- Reject patterns that do not transfer beyond the source repository.
- Do not revise in this pass. Return accept or reject only.
- Do not weaken deterministic requirements: the harness still decides final acceptance.

Return strict JSON:

```json
{
  "reviews": [
    {
      "id": "pattern-id",
      "decision": "accept | reject",
      "reason": "evidence-based reason"
    }
  ]
}
```
