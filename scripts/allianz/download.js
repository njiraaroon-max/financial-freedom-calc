#!/usr/bin/env node
/**
 * Download all Allianz premium-table images listed in the manifest.
 *
 * Reads: src/data/allianz/manifest.json
 * Writes: scripts/allianz/images/<code>_<index>.<ext>
 *
 * Usage:
 *   node scripts/allianz/download.js
 *   node scripts/allianz/download.js --force   # re-download existing
 */

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const ROOT = path.resolve(__dirname, "../..");
const MANIFEST = path.join(ROOT, "src/data/allianz/manifest.json");
const OUT_DIR = path.join(__dirname, "images");
const force = process.argv.includes("--force");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const all = [
  ...manifest.category_1_life_main,
  ...manifest.category_2_health_rider,
];

function extFromUrl(url) {
  const m = url.match(/\.(png|jpg|jpeg|gif|webp|PNG|JPG|JPEG)(\?|$)/);
  return m ? m[1].toLowerCase() : "jpg";
}

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const f = fs.createWriteStream(outPath);
        res.pipe(f);
        f.on("finish", () => f.close(() => resolve()));
        f.on("error", reject);
      })
      .on("error", reject);
  });
}

(async () => {
  let ok = 0,
    skipped = 0,
    failed = 0;
  const failures = [];
  for (const p of all) {
    const imgs = p.premium_images || [];
    for (let i = 0; i < imgs.length; i++) {
      const url = imgs[i];
      const ext = extFromUrl(url);
      const fname = imgs.length > 1 ? `${p.code}_${i + 1}.${ext}` : `${p.code}.${ext}`;
      const outPath = path.join(OUT_DIR, fname);

      if (fs.existsSync(outPath) && !force) {
        skipped++;
        continue;
      }
      try {
        process.stdout.write(`→ ${fname} ... `);
        await download(url, outPath);
        const size = fs.statSync(outPath).size;
        console.log(`OK (${(size / 1024).toFixed(1)} KB)`);
        ok++;
      } catch (err) {
        console.log(`FAIL (${err.message})`);
        failed++;
        failures.push({ product: p.code, url, error: err.message });
      }
    }
  }
  console.log(
    `\nDone. ok=${ok} skipped=${skipped} failed=${failed} / total ${ok + skipped + failed}`
  );
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  ${f.product}: ${f.url} — ${f.error}`);
  }
})();
