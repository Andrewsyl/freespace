import fs from "fs";
import path from "path";

const migrationsDir = path.join(process.cwd(), "db/migrations");
const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();

const seen = new Set();
for (const file of files) {
  if (seen.has(file)) {
    console.error(`Duplicate migration filename: ${file}`);
    process.exit(1);
  }
  seen.add(file);
  if (!/^\d{3}_.+\.sql$/.test(file)) {
    console.error(`Migration does not follow NNN_name.sql format: ${file}`);
    process.exit(1);
  }
}

console.log(`Migration naming checks passed for ${files.length} files`);
