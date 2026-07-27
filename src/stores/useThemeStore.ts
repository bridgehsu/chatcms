import { create } from "zustand";

export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "chatcms.theme";

const readStored = (): ThemePreference => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
    // 旧版 system → 默认深色
    if (v === "system") return "dark";
  } catch {
    /* ignore */
  }
  return "dark";
};

export const applyThemeToDocument = (theme: ThemePreference) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const preference = readStored();
  if (typeof document !== "undefined") {
    applyThemeToDocument(preference);
  }

  return {
    preference,
    setPreference: (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      applyThemeToDocument(next);
      set({ preference: next });
    },
    toggle: () => {
      const next = get().preference === "dark" ? "light" : "dark";
      get().setPreference(next);
    },
  };
});
