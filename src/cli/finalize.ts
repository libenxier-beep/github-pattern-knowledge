import path from "node:path";
import { finalizeDeepDive } from "../scheduler/finalizeDeepDive";

function manifestArg(): string {
  const index = process.argv.indexOf("--manifest");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error("Usage: npm run finalize -- --manifest <value_manifest.json>");
  return path.resolve(value);
}

async function main(): Promise<void> {
  const result = await finalizeDeepDive({ projectRoot: process.cwd(), manifestPath: manifestArg() });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
