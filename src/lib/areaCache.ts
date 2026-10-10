/**
 * Two-level cache for fetched study areas: an in-process map plus a JSON file per area under the
 * OS temp directory. The disk layer means a once-loaded area survives a dev-server restart and a
 * serverless instance reuse, so a demo does not depend on Overpass answering again.
 * Server-only: do not import from a Client Component.
 */
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AreaFeatureCollection } from "@/types";

const TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_MAX_ENTRIES = 24;
const DISK_MAX_FILES = 60;
const DISK_DIR = path.join(os.tmpdir(), "greengap-areas");

const memory = new Map<string, { at: number; data: AreaFeatureCollection }>();

const fileFor = (key: string) => path.join(DISK_DIR, `${key.replace(/[^\d.,-]/g, "")}.json`);

function readMemory(key: string): AreaFeatureCollection | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    memory.delete(key);
    return null;
  }
  // Refresh recency for LRU eviction.
  memory.delete(key);
  memory.set(key, hit);
  return hit.data;
}

function writeMemory(key: string, data: AreaFeatureCollection, at = Date.now()) {
  memory.set(key, { at, data });
  while (memory.size > MEMORY_MAX_ENTRIES) {
    const oldest = memory.keys().next();
    if (oldest.done) break;
    memory.delete(oldest.value);
  }
}

export type CacheSource = "memory" | "disk";

export async function readAreaCache(key: string): Promise<{ data: AreaFeatureCollection; source: CacheSource } | null> {
  const fromMemory = readMemory(key);
  if (fromMemory) return { data: fromMemory, source: "memory" };

  try {
    const file = fileFor(key);
    const info = await stat(file);
    if (Date.now() - info.mtimeMs > TTL_MS) {
      await unlink(file).catch(() => {});
      return null;
    }
    const data = JSON.parse(await readFile(file, "utf8")) as AreaFeatureCollection;
    writeMemory(key, data, info.mtimeMs);
    return { data, source: "disk" };
  } catch {
    // Missing file or unreadable cache is not an error; the caller will fetch.
    return null;
  }
}

export async function writeAreaCache(key: string, data: AreaFeatureCollection): Promise<void> {
  writeMemory(key, data);
  try {
    await mkdir(DISK_DIR, { recursive: true });
    await writeFile(fileFor(key), JSON.stringify(data));
    await pruneDisk();
  } catch (err) {
    // A read-only or full filesystem only costs us the disk layer.
    console.warn(`[areaCache] could not persist ${key}: ${err instanceof Error ? err.message : err}`);
  }
}

async function pruneDisk(): Promise<void> {
  const names = await readdir(DISK_DIR);
  if (names.length <= DISK_MAX_FILES) return;

  const entries = await Promise.all(
    names.map(async (name) => {
      const file = path.join(DISK_DIR, name);
      try {
        return { file, mtime: (await stat(file)).mtimeMs };
      } catch {
        return null;
      }
    }),
  );

  const sorted = entries.filter((e): e is { file: string; mtime: number } => e !== null).sort((a, b) => a.mtime - b.mtime);
  await Promise.all(sorted.slice(0, sorted.length - DISK_MAX_FILES).map((e) => unlink(e.file).catch(() => {})));
}
