import { chmodSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const hookPath = path.join(repoRoot, ".githooks");
const prePushHook = path.join(hookPath, "pre-push");

if (!existsSync(prePushHook)) {
  console.error(`Missing hook file: ${prePushHook}`);
  process.exit(1);
}

chmodSync(prePushHook, 0o755);
execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log("Git hooks installed from .githooks");
