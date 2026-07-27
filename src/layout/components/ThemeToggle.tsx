import { useEffect, useRef, useState } from "react";
import { IconCheck, IconMoon, IconSun } from "@/components/icons";
import {
  type ThemePreference,
  useThemeStore,
} from "@/stores/useThemeStore";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
}[] = [
  {
    value: "system",
    label: "跟随系统",
    hint: "自动匹配系统外观",
  },
  {
    value: "light",
    label: "白天",
    hint: "浅色界面",
  },
  {
    value: "dark",
    label: "黑夜",
    hint: "深色界面",
  },
];

/** 顶栏外观菜单：跟随系统 / 白天 / 黑夜 */
export const ThemeToggle = () => {
  const preference = useThemeStore((s) => s.preference);
  const resolved = useThemeStore((s) => s.resolved);
  const setPreference = useThemeStore((s) => s.setPreference);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current =
    OPTIONS.find((o) => o.value === preference) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      className={`theme-menu${open ? " is-open" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="theme-menu__trigger"
        aria-label="外观"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="theme-menu__trigger-icon" aria-hidden="true">
          {resolved === "dark" ? <IconMoon /> : <IconSun />}
        </span>
        <span className="theme-menu__trigger-label">{current.label}</span>
        <span className="theme-menu__chevron" aria-hidden="true" />
      </button>

      {open ? (
        <ul className="theme-menu__list" role="listbox" aria-label="外观">
          {OPTIONS.map((opt) => {
            const active = opt.value === preference;
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`theme-menu__option${active ? " is-active" : ""}`}
                  onClick={() => {
                    setPreference(opt.value);
                    setOpen(false);
                  }}
                >
                  <span className="theme-menu__option-icon" aria-hidden="true">
                    {opt.value === "system" ? (
                      <span className="theme-menu__system-glyph" />
                    ) : opt.value === "dark" ? (
                      <IconMoon />
                    ) : (
                      <IconSun />
                    )}
                  </span>
                  <span className="theme-menu__option-text">
                    <span className="theme-menu__option-label">{opt.label}</span>
                    <span className="theme-menu__option-hint">{opt.hint}</span>
                  </span>
                  {active ? (
                    <span className="theme-menu__check" aria-hidden="true">
                      <IconCheck />
                    </span>
                  ) : (
                    <span className="theme-menu__check-spacer" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
