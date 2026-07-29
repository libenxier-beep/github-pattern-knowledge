import { validateAutomationReadiness } from "../harness/automationReadiness";

const result = await validateAutomationReadiness(process.cwd());
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
