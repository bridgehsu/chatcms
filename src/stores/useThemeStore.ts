import { create } from "zustand";

/** 用户偏好：跟随系统 / 浅色 / 深色 */
export type ThemePreference = "system" | "light" | "dark";

/** 实际落到 DOM 的主题 */
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "chatcms.theme";

const systemTheme = (): ResolvedTheme => {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const resolveTheme = (preference: ThemePreference): ResolvedTheme =>
  preference === "system" ? systemTheme() : preference;

const readStored = (): ThemePreference => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "system" || v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "system";
};

export const applyThemeToDocument = (theme: ResolvedTheme) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

let mediaCleanup: (() => void) | null = null;

const bindSystemListener = (onChange: () => void) => {
  mediaCleanup?.();
  mediaCleanup = null;
  if (typeof window === "undefined") return;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange();
  mq.addEventListener("change", handler);
  mediaCleanup = () => mq.removeEventListener("change", handler);
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const preference = readStored();
  const resolved = resolveTheme(preference);
  if (typeof document !== "undefined") {
    applyThemeToDocument(resolved);
  }

  const syncFromSystem = () => {
    if (get().preference !== "system") return;
    const next = resolveTheme("system");
    applyThemeToDocument(next);
    set({ resolved: next });
  };

  if (preference === "system") {
    bindSystemListener(syncFromSystem);
  }

  return {
    preference,
    resolved,
    setPreference: (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      const resolvedNext = resolveTheme(next);
      applyThemeToDocument(resolvedNext);
      if (next === "system") {
        bindSystemListener(syncFromSystem);
      } else {
        mediaCleanup?.();
        mediaCleanup = null;
      }
      set({ preference: next, resolved: resolvedNext });
    },
  };
});
