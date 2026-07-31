import { buildFinalizationRepairPlan } from "../scheduler/finalizationRepairPolicy";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const runId = arg("--run-id");
const attempt = Number(arg("--attempt"));
const error = arg("--error");

if (!runId || !Number.isInteger(attempt) || !error) {
  throw new Error(
    "Usage: npm run finalization-repair-plan -- --run-id <run-id> --attempt <positive integer> --error <exact finalization error>"
  );
}

process.stdout.write(`${JSON.stringify(buildFinalizationRepairPlan({ runId, attempt, error }), null, 2)}\n`);
