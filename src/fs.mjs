import { mkdir, writeFile, readFile, chmod, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function ensureParent(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function writeJson(filePath, value, mode) {
  await ensureParent(filePath);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  if (mode) {
    await chmod(filePath, mode);
  }
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function appendJsonl(filePath, value) {
  await ensureParent(filePath);
  await appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

