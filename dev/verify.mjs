/**
 * Quick static + local-server checks for SL Arcade pub assets.
 * Run: node dev/verify.mjs
 * Requires: python -m http.server 8765 (from pub/)
 */
import http from "node:http";

const BASE = "http://127.0.0.1:8765";
const paths = [
  "/",
  "/index.html",
  "/games/manifest.json",
  "/games/invaders/",
  "/games/invaders/index.html",
  "/games/invaders/game.js",
  "/games/invaders/style.css",
  "/shared/sl-api.js",
  "/shared/hub.js",
];

function get(path) {
  return new Promise((resolve, reject) => {
    http
      .get(BASE + path, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () =>
          resolve({ path, status: res.statusCode, body, type: res.headers["content-type"] })
        );
      })
      .on("error", reject);
  });
}

let failed = 0;
for (const path of paths) {
  try {
    const r = await get(path);
    const ok = r.status === 200;
    if (!ok) failed++;
    console.log((ok ? "OK " : "FAIL") + " " + r.status + " " + path);
    if (path.endsWith("index.html") && !r.body.includes("SLArcade") && !r.body.includes("SL INVADERS") && !r.body.includes("SL Arcade")) {
      console.log("  warn: unexpected HTML content");
      failed++;
    }
    if (path.endsWith("invaders/index.html") && !r.body.includes("../../shared/sl-api.js")) {
      console.log("  fail: sl-api.js path missing");
      failed++;
    }
    if (path.endsWith("manifest.json")) {
      const data = JSON.parse(r.body);
      if (!data.games?.some((g) => g.id === "invaders")) {
        console.log("  fail: invaders not in manifest");
        failed++;
      }
    }
  } catch (e) {
    failed++;
    console.log("FAIL " + path + " " + e.message);
  }
}

if (failed) {
  console.error("\n" + failed + " check(s) failed. Start server: cd pub && python -m http.server 8765");
  process.exit(1);
}
console.log("\nAll local checks passed.");
