import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";

const KEY = "local-ai-chat:theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

const read = (): ThemePreference => {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
};

function apply() {
  const pref = read();
  document.documentElement.classList.toggle(
    "dark",
    pref === "dark" || (pref === "system" && media.matches),
  );
}

/** Call once at startup: applies the saved choice and follows the system setting while it is "system". */
export function initTheme() {
  apply();
  media.addEventListener("change", () => {
    apply();
    listeners.forEach((l) => l());
  });
}

export function setTheme(pref: ThemePreference) {
  if (pref === "system") localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, pref);
  apply();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useThemePreference = () =>
  useSyncExternalStore(subscribe, read, () => "system" as const);
