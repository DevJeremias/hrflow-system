import { spawn } from "node:child_process";

const isBun = process.env.npm_config_user_agent?.startsWith("bun/");
const execPath = process.env.npm_execpath ?? (isBun ? "bun" : "npm");
const workspaceArgs = (workspace) =>
  isBun ? ["run", "--cwd", workspace, "dev"] : ["run", "--prefix", workspace, "dev"];

const children = ["frontend", "backend"].map((workspace) =>
  spawn(execPath, workspaceArgs(workspace), {
    stdio: "inherit",
  }),
);

let stopping = false;

function stopChildren(signal = "SIGTERM") {
  for (const child of children) {
    if (child.exitCode !== null) continue;
    child.kill(signal);
  }
}

function finish(code) {
  if (stopping) return;
  stopping = true;
  stopChildren();
  setTimeout(() => {
    stopChildren("SIGKILL");
    process.exit(code);
  }, 2000).unref();
}

for (const child of children) {
  child.once("error", () => finish(1));
  child.once("close", (code, signal) => {
    if (stopping) return;
    finish(code ?? (signal ? 1 : 0));
  });
}

process.once("SIGINT", () => finish(130));
process.once("SIGTERM", () => finish(143));
