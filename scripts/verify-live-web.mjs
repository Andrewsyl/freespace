const baseUrl = process.env.LIVE_WEB_BASE_URL ?? "https://www.freespace.ie";
const expectedSha = process.env.EXPECTED_BUILD_SHA ?? process.env.GITHUB_SHA;
const timeoutMs = Number(process.env.VERIFY_LIVE_TIMEOUT_MS ?? "600000");
const intervalMs = Number(process.env.VERIFY_LIVE_INTERVAL_MS ?? "15000");
const targetPath = process.env.VERIFY_LIVE_PATH ?? "/";

if (!expectedSha) {
  console.error("EXPECTED_BUILD_SHA or GITHUB_SHA is required");
  process.exit(1);
}

const deadline = Date.now() + timeoutMs;
let lastSeenSha = null;
let attempt = 0;

const extractBuildSha = (html) => {
  const match = html.match(/data-build-sha="([^"]+)"/);
  return match?.[1] ?? null;
};

while (Date.now() < deadline) {
  attempt += 1;
  const separator = targetPath.includes("?") ? "&" : "?";
  const url = `${baseUrl}${targetPath}${separator}build_sha_probe=${expectedSha}&attempt=${attempt}`;

  try {
    const response = await fetch(url, {
      headers: {
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
    });

    if (response.status !== 200) {
      console.log(`[verify-live-web] attempt ${attempt}: ${url} -> ${response.status}`);
    } else {
      const html = await response.text();
      const buildSha = extractBuildSha(html);
      lastSeenSha = buildSha;

      if (buildSha === expectedSha) {
        console.log(`[verify-live-web] live site is serving ${expectedSha}`);
        process.exit(0);
      }

      console.log(
        `[verify-live-web] attempt ${attempt}: expected ${expectedSha}, saw ${buildSha ?? "no-marker"}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[verify-live-web] attempt ${attempt}: request failed -> ${message}`);
  }

  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

console.error(
  `[verify-live-web] timed out waiting for ${expectedSha}. Last seen build marker: ${lastSeenSha ?? "none"}`
);
process.exit(1);
