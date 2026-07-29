import { abortRunLease } from "../scheduler/runLease";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const runId = arg("--run-id");
if (!runId) throw new Error("Usage: npm run automation-abort -- --run-id <run-id> --reason <reason>");
const result = await abortRunLease(process.cwd(), runId, arg("--reason") ?? "caller reported a failed gate");
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
