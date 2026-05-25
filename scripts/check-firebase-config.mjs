import fs from "fs";
import path from "path";
import { createRequire } from "module";

const root = process.cwd();
const files = [
  "apps/mobile/google-services.json",
  "apps/mobile/android/app/google-services.json",
].map((file) => path.join(root, file));

const require = createRequire(import.meta.url);
const appConfigPath = path.join(root, "apps/mobile/app.config.js");
const appJsonPath = path.join(root, "apps/mobile/app.json");
const loadExpoConfig = () => {
  const appConfigModule = require(appConfigPath);
  const appConfigExport = appConfigModule.default ?? appConfigModule;
  return typeof appConfigExport === "function" ? appConfigExport({ config: {} }) : appConfigExport;
};

const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
const expoConfig = loadExpoConfig();
const requiredPackages = [...new Set([
  appJson?.expo?.android?.package,
  expoConfig?.android?.package,
].filter(Boolean))];

if (requiredPackages.length !== 2) {
  console.error("Could not determine expected Android package names from apps/mobile/app.json and apps/mobile/app.config.js");
  process.exit(1);
}

const readClients = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  return new Set(
    (data.client ?? []).map((client) => client?.client_info?.android_client_info?.package_name).filter(Boolean)
  );
};

const snapshots = files.map((file) => ({
  file,
  clients: readClients(file),
}));

for (const { file, clients } of snapshots) {
  for (const packageName of requiredPackages) {
    if (!clients.has(packageName)) {
      console.error(`${path.relative(root, file)} is missing Firebase client for ${packageName}`);
      process.exit(1);
    }
  }
}

const [first, second] = snapshots;
for (const packageName of requiredPackages) {
  if (first.clients.has(packageName) !== second.clients.has(packageName)) {
    console.error("Firebase client sets differ between root and Android app google-services.json files");
    process.exit(1);
  }
}

console.log("Firebase config sanity checks passed");
