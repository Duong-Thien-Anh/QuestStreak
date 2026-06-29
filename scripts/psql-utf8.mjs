import { resolveDatabaseUrl } from "./_db-url.mjs";
import { spawn } from "node:child_process";

const child = spawn("psql", [resolveDatabaseUrl()], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    PGCLIENTENCODING: "UTF8",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
