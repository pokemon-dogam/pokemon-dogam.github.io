import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const root = new URL("../", import.meta.url);
const rootPath = root.pathname;
const failures = [];
const htmlFiles = readdirSync(rootPath).filter((name) => extname(name) === ".html");
const jsFiles = readdirSync(rootPath).filter((name) => extname(name) === ".js");

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", join(rootPath, file)], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failures.push(`${file}: ${result.stderr || result.stdout}`);
  }
}

for (const file of htmlFiles) {
  const source = readFileSync(join(rootPath, file), "utf8");
  const references = [
    ...source.matchAll(/(?:src|href)=["']\.\/([^"'?#]+)[^"']*["']/g),
  ].map((match) => match[1]);
  for (const reference of references) {
    if (!existsSync(join(rootPath, reference))) {
      failures.push(`${file}: missing local reference ${reference}`);
    }
  }
}

const required = [
  "index.html",
  "national.html",
  "packs.html",
  "artists.html",
  "series.html",
  "pokemon-collections.html",
  "ar.html",
  "people.html",
  "collector-settings.html",
  "collectors.html",
  "collector.html",
  "firestore.rules",
];
for (const file of required) {
  if (!existsSync(join(rootPath, file))) failures.push(`missing required file ${file}`);
}

const rules = readFileSync(join(rootPath, "firestore.rules"), "utf8");
for (const protectedPath of [
  "sharedDexViews",
  "siteMetrics/public",
  "siteDailyMetrics",
  "siteUserRegistry",
  "siteFeedback",
  "users/{userId}/collections/{collectionId}",
]) {
  if (!rules.includes(protectedPath)) {
    failures.push(`firestore.rules: existing protected path missing: ${protectedPath}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Checked ${jsFiles.length} JavaScript files and ${htmlFiles.length} HTML files.`);
