import { runSeedIngest } from "../scheduler/seedIngest";
import { ensureSeedManifest, getPendingSeeds } from "../seeds/seedPool";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const listOnly = process.argv.includes("--list");
const limitText = argValue("limit");
const reposText = argValue("repos");
const limit = limitText ? Number.parseInt(limitText, 10) : undefined;
const repos = reposText ? reposText.split(",").map((repo) => repo.trim()).filter(Boolean) : undefined;

if (listOnly) {
  await ensureSeedManifest(process.cwd());
  const pending = await getPendingSeeds(process.cwd());
  console.log(JSON.stringify({ pending_count: pending.length, pending }, null, 2));
} else {
  const result = await runSeedIngest({ limit, repos });
  console.log(JSON.stringify(result, null, 2));
}
