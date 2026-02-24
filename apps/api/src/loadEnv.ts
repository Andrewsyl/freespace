import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load env files (root and api-local) for local development only.
// In production (e.g. Elastic Beanstalk), environment variables should come from the host.
const rootEnv = path.resolve(__dirname, "../../../.env");
const rootEnvLocal = path.resolve(__dirname, "../../../.env.local");
const apiEnv = path.resolve(__dirname, "../.env");
const apiEnvLocal = path.resolve(__dirname, "../.env.local");

if (process.env.NODE_ENV !== "production") {
  // Load in order, allowing later files to override earlier ones.
  dotenv.config({ path: rootEnv });
  dotenv.config({ path: rootEnvLocal, override: true });
  dotenv.config({ path: apiEnv, override: true });
  dotenv.config({ path: apiEnvLocal, override: true });
}
