#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function usageAndExit(message) {
  if (message) console.error(`[play] ${message}`);
  console.error(
    `Usage: node scripts/play-upload-aab.mjs --aab-path <path> [--package-name <id>] [--track <internal|closed|production>] [--release-name <name>] [--notes <text>]`
  );
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) usageAndExit(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) usageAndExit(`Missing value for --${key}`);
    out[key] = value;
    i += 1;
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signJwt({ clientEmail, privateKey, scope }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${signingInput}.${base64Url(signature)}`;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) {
    let detail = text;
    if (contentType.includes("application/json")) {
      try {
        detail = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // keep raw text
      }
    }
    throw new Error(`${res.status} ${res.statusText}\n${detail}`);
  }

  if (!text) return null;
  if (contentType.includes("application/json")) return JSON.parse(text);
  return text;
}

async function getAccessToken(serviceAccount) {
  const assertion = signJwt({
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
    scope: "https://www.googleapis.com/auth/androidpublisher",
  });

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const tokenResponse = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  return tokenResponse.access_token;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const aabPath = args["aab-path"];
  if (!aabPath) usageAndExit("--aab-path is required");

  const packageName = args["package-name"] || process.env.GOOGLE_PLAY_PACKAGE_NAME || "ie.freespace.app";
  const track = args["track"] || process.env.GOOGLE_PLAY_TRACK || "internal";
  const releaseName = args["release-name"] || process.env.GOOGLE_PLAY_RELEASE_NAME || path.basename(aabPath);
  const notes = args["notes"] || process.env.GOOGLE_PLAY_RELEASE_NOTES || "Bug fixes and updates.";

  const appJsonPath = path.resolve("app.json");
  const appJson = readJson(appJsonPath);
  const versionName = appJson?.expo?.version || "0.1.0";
  const versionCode = String(appJson?.expo?.android?.versionCode || "");
  if (!versionCode) usageAndExit(`Could not read expo.android.versionCode from ${appJsonPath}`);

  const serviceAccountPath =
    args["service-account-json"] ||
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH ||
    "";

  if (!serviceAccountPath) {
    usageAndExit(
      "Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON or GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH to a Play service-account JSON file."
    );
  }

  const resolvedServiceAccountPath = path.resolve(serviceAccountPath);
  if (!fs.existsSync(resolvedServiceAccountPath)) {
    usageAndExit(`Service account JSON not found: ${resolvedServiceAccountPath}`);
  }

  const resolvedAabPath = path.resolve(aabPath);
  if (!fs.existsSync(resolvedAabPath)) {
    usageAndExit(`AAB not found: ${resolvedAabPath}`);
  }

  const serviceAccount = readJson(resolvedServiceAccountPath);
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    usageAndExit(`Service account JSON is missing client_email/private_key: ${resolvedServiceAccountPath}`);
  }

  console.log(`[play] package: ${packageName}`);
  console.log(`[play] track: ${track}`);
  console.log(`[play] version: ${versionName} (${versionCode})`);
  console.log(`[play] AAB: ${resolvedAabPath}`);

  const accessToken = await getAccessToken(serviceAccount);
  const authHeaders = { authorization: `Bearer ${accessToken}` };

  const edit = await fetchJson(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits`, {
    method: "POST",
    headers: authHeaders,
  });

  const editId = edit.id;
  if (!editId) throw new Error("Android Publisher API did not return an edit ID");

  console.log(`[play] edit: ${editId}`);

  const bundleBytes = fs.readFileSync(resolvedAabPath);
  const uploadedBundle = await fetchJson(
    `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${packageName}/edits/${editId}/bundles?uploadType=media`,
    {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/octet-stream",
      },
      body: bundleBytes,
    }
  );

  const uploadedVersionCode =
    uploadedBundle?.versionCode || uploadedBundle?.versioncodes?.[0] || versionCode;
  console.log(`[play] uploaded bundle versionCode=${uploadedVersionCode}`);

  await fetchJson(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits/${editId}/tracks/${track}`,
    {
      method: "PUT",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        track,
        releases: [
          {
            name: releaseName,
            status: "completed",
            versionCodes: [String(uploadedVersionCode)],
            releaseNotes: [{ language: "en-US", text: notes }],
          },
        ],
      }),
    }
  );

  await fetchJson(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits/${editId}:commit`,
    {
      method: "POST",
      headers: authHeaders,
    }
  );

  console.log(`[play] uploaded and committed ${versionName} (${uploadedVersionCode}) to ${track}`);
}

main().catch((error) => {
  console.error("[play] upload failed");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
