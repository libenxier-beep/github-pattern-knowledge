import { validateAutomationDeployment } from "../harness/automationDeploymentIntegrity";

const result = await validateAutomationDeployment(process.cwd());
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
