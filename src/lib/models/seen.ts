export const SEEN_MODELS_KEY = "local-ai-chat:seen-models";

/**
 * Which catalog models are new since this browser last looked. `seen === null` means the browser has never
 * recorded a list (a first visit, or a visit from before this feature): nothing is announced then, the current
 * catalog is simply remembered.
 */
export function unseenModels(seen: string[] | null, catalogIds: string[]): string[] {
  return seen === null ? [] : catalogIds.filter((id) => !seen.includes(id));
}

export function readSeenModels(): string[] | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_MODELS_KEY) ?? "null");
    return Array.isArray(parsed) && parsed.every((x) => typeof x === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function writeSeenModels(ids: string[]) {
  try {
    localStorage.setItem(SEEN_MODELS_KEY, JSON.stringify(ids));
  } catch {
    // blocked storage: the announcement may repeat, which is harmless
  }
}
