import { spawnSync } from "node:child_process";

const [workspace, script, ...args] = process.argv.slice(2);
if (!workspace || !script) {
  console.error("Uso: node scripts/run-workspace.mjs <workspace> <script> [...args]");
  process.exit(1);
}

const isBun = process.env.npm_config_user_agent?.startsWith("bun/");
const execPath = process.env.npm_execpath ?? (isBun ? "bun" : "npm");
const commandArgs = isBun
  ? ["run", "--cwd", workspace, script, ...args]
  : ["run", "--prefix", workspace, script, ...args];
const result = spawnSync(execPath, commandArgs, { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
