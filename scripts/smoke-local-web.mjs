import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = process.env.SMOKE_WEB_PORT ?? "3100";
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;

const checks = [
  { name: "root", path: "/" },
  { name: "login", path: "/login" },
  { name: "search", path: "/search" },
  { name: "admin dashboard", path: "/admin/dashboard" },
];

const server = spawn("node", ["apps/web/.next/standalone/apps/web/server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: host,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";

server.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});

server.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

const cleanup = () => {
  if (!server.killed) {
    server.kill("SIGTERM");
  }
};

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Web server exited early with code ${server.exitCode}\n${stderr || stdout}`);
    }
    try {
      const response = await fetch(`${baseUrl}/login`, { redirect: "manual" });
      if (response.status === 200) {
        return;
      }
    } catch {
      // retry until deadline
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for local web server\n${stderr || stdout}`);
}

async function runChecks() {
  for (const check of checks) {
    const response = await fetch(`${baseUrl}${check.path}`, { redirect: "manual" });
    if (response.status !== 200) {
      throw new Error(`Smoke failed for ${check.name}: expected 200, got ${response.status}`);
    }
  }
}

try {
  await waitForServer();
  await runChecks();
  console.log(`Local web smoke passed at ${baseUrl}`);
} finally {
  cleanup();
}
