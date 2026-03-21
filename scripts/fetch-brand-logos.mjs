import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const BRANDS = [
  "Audi",
  "BMW",
  "Citroen",
  "Cupra",
  "Dacia",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Kia",
  "Land Rover",
  "Mazda",
  "Mercedes-Benz",
  "Mini",
  "Nissan",
  "Opel",
  "Peugeot",
  "Renault",
  "Seat",
  "Skoda",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const SEARCH_OVERRIDES = {
  BMW: "BMW logo svg",
  Citroen: "Citroën logo svg",
  Honda: "Honda logo svg",
  "Mercedes-Benz": "Mercedes-Benz logo svg",
  "Land Rover": "Land Rover logo svg",
  Seat: "SEAT logo svg",
  Skoda: "Škoda logo svg",
};

const OUTPUT_DIR = path.resolve("apps/mobile/assets/brand-logos");
const OUTPUT_TS = path.resolve("apps/mobile/components/vehicleBrandLogos.generated.ts");

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function curl(args) {
  return execFileSync("curl", ["-A", "Codex/1.0", ...args], { encoding: "utf8" });
}

function download(url, target) {
  execFileSync("curl", ["-A", "Codex/1.0", "-L", "-s", url, "-o", target], { stdio: "inherit" });
}

function fetchSearchResult(brand) {
  const query = encodeURIComponent(SEARCH_OVERRIDES[brand] ?? `${brand} logo svg`);
  let raw = "";
  let json;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    raw = curl([
      "-s",
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&generator=search&gsrsearch=${query}&gsrnamespace=6&gsrlimit=8`,
    ]);
    try {
      json = JSON.parse(raw);
      break;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300 * (attempt + 1));
    }
  }
  if (!json) {
    throw new Error(`Invalid Commons response for ${brand}: ${raw.slice(0, 120)}`);
  }
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
  if (!pages.length) {
    throw new Error(`No Commons results for ${brand}`);
  }

  const normalizedBrand = brand.toLowerCase().replace(/[^a-z0-9]/g, "");
  const ranked = pages.sort((a, b) => {
    const score = (page) => {
      const title = String(page.title || "").toLowerCase();
      let value = page.index ?? 999;
      if (title.includes("old")) value += 20;
      if (title.includes("f1") || title.includes("racing") || title.includes("team")) value += 20;
      if (title.match(/\b(19|20)\d{2}\b/) && !title.includes("202")) value += 5;
      if (!title.includes("logo")) value += 6;
      if (title.includes("wordmark")) value -= 2;
      const normalizedTitle = title.replace(/[^a-z0-9]/g, "");
      if (!normalizedTitle.includes(normalizedBrand)) value += 8;
      if (normalizedTitle === `file${normalizedBrand}logosvg`) value -= 10;
      if (normalizedTitle.startsWith(`file${normalizedBrand}`) && normalizedTitle.includes("logo")) value -= 4;
      return value;
    };
    return score(a) - score(b);
  });

  const best = ranked[0];
  const url = best.imageinfo?.[0]?.url;
  if (!url) {
    throw new Error(`No SVG URL for ${brand}`);
  }
  return { title: best.title, url };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  ensureDir(OUTPUT_DIR);
  const downloaded = {};

  for (const brand of BRANDS) {
    const slug = slugify(brand);
    const { title, url } = fetchSearchResult(brand);
    const target = path.join(OUTPUT_DIR, `${slug}.svg`);
    download(url, target);
    const xml = fs.readFileSync(target, "utf8").trim();
    downloaded[brand] = xml;
    console.log(`saved ${brand}: ${title}`);
  }

  const file = `// Generated from local brand SVG assets\nexport const brandSvgXml: Record<string, string> = ${JSON.stringify(downloaded, null, 2)} as const;\n`;
  fs.writeFileSync(OUTPUT_TS, file);
}

main();
