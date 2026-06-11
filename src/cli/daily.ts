import { runDaily } from "../scheduler/daily";

const forceFixture = process.argv.includes("--fixture") || process.env.USE_FIXTURE === "1";
const skipSeeds = process.argv.includes("--skip-seeds");

runDaily({ forceFixture, skipSeeds })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
