import cron from "node-cron";
import { runDaily } from "../scheduler/daily";

const schedule = process.env.DAILY_CRON ?? "0 9 * * *";

console.log(`Scheduler active: ${schedule}`);
cron.schedule(schedule, async () => {
  try {
    const result = await runDaily();
    console.log(`[${new Date().toISOString()}] daily run ${result.run_id} ${result.status}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
});
