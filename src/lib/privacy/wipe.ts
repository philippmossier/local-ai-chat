import { STORAGE_KEY } from "../chat/store";
import { SEEN_MODELS_KEY } from "../models/seen";

const MODEL_KEY = "local-ai-chat:model";
/** Models whose load finished at least once, as `repo@revision:dtype`. */
const COMPLETE_KEY = "local-ai-chat:complete-models";
export const PREFS = { MODEL_KEY, COMPLETE_KEY };

/** Removes everything this app stored in the browser: chats, settings and the downloaded model files. */
export async function wipeAllData(): Promise<void> {
  for (const key of [STORAGE_KEY, MODEL_KEY, SEEN_MODELS_KEY, COMPLETE_KEY])
    localStorage.removeItem(key);
  if ("caches" in window) {
    for (const name of await caches.keys()) await caches.delete(name);
  }
  const databases = await indexedDB.databases?.();
  for (const db of databases ?? []) if (db.name) indexedDB.deleteDatabase(db.name);
}

const completeEntry = (repo: string, revision: string, dtype: string) =>
  `${repo}@${revision}:${dtype}`;

function readComplete(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COMPLETE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Called after a load finished: only then are all of the model's files in the cache. */
export function markModelComplete(repo: string, revision: string, dtype: string) {
  const entry = completeEntry(repo, revision, dtype);
  const list = readComplete();
  if (list.includes(entry)) return;
  try {
    localStorage.setItem(COMPLETE_KEY, JSON.stringify([...list, entry]));
  } catch {
    // storage full or blocked: the model will show its loading screen next time, nothing worse
  }
}

export function isMarkedComplete(repo: string, revision: string, dtype: string): boolean {
  return readComplete().includes(completeEntry(repo, revision, dtype));
}

/**
 * Is the model fully on this device in this weight format? Lets a returning visitor skip the download
 * screen. A cancelled download leaves some files behind and q4 and q4f16 are different files, so the
 * cache alone is not enough: the load must have finished once (the marker), and the files must still be
 * there (browsers evict caches). The key includes the pinned revision.
 */
export async function isModelCached(
  repo: string,
  revision: string,
  dtype: string,
): Promise<boolean> {
  if (!isMarkedComplete(repo, revision, dtype)) return false;
  if (!("caches" in window)) return false;
  try {
    const cache = await caches.open("transformers-cache");
    const keys = await cache.keys();
    return keys.some(
      (r) => r.url.includes(`/${repo}/resolve/${revision}/`) && r.url.includes(".onnx"),
    );
  } catch {
    return false;
  }
}
