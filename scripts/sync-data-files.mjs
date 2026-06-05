import { copyFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");

const EXCLUDE = new Set(["package-lock.json", "package.json", "node_modules"]);

async function syncDataFiles() {
  await mkdir(PUBLIC_DATA_DIR, { recursive: true });
  const files = await readdir(DATA_DIR);
  let copied = 0;
  for (const file of files) {
    if (EXCLUDE.has(file)) continue;
    const src = path.join(DATA_DIR, file);
    const dest = path.join(PUBLIC_DATA_DIR, file);
    await copyFile(src, dest);
    copied++;
  }
  console.log(`Synced ${copied} data file(s) to public/data/`);
}

syncDataFiles().catch((err) => {
  console.error("Failed to sync data files:", err);
  process.exit(1);
});
