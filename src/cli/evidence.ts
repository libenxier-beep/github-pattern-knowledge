import { backfillPatternEvidence } from "../knowledge/evidenceBackfill";

const result = await backfillPatternEvidence(process.cwd());
console.log(JSON.stringify(result, null, 2));
