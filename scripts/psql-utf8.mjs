import "dotenv/config";
import { spawn } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const child = spawn("psql", [databaseUrl], {
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
