import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  { value: "system", label: "跟随系统", hint: "自动匹配系统外观" },
  { value: "light",  label: "白天",     hint: "浅色界面" },
  { value: "dark",   label: "黑夜",     hint: "深色界面" },
];

export const ThemeToggle = () => {
  const preference  = useThemeStore((s) => s.preference);
  const resolved    = useThemeStore((s) => s.resolved);
  const setPreference = useThemeStore((s) => s.setPreference);
  const [open, setOpen]   = useState(false);
  const [pos,  setPos]    = useState({ bottom: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  // 计算弹窗位置（fixed，相对视口）
  const openMenu = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        bottom: window.innerHeight - rect.top + 6,
        left: rect.left,
      });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".theme-menu__list")) setOpen(false);
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
    <div className={`theme-menu${open ? " is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="theme-menu__trigger"
        aria-label="外观"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={openMenu}
      >
        <span className="theme-menu__trigger-icon" aria-hidden="true">
          {resolved === "dark" ? <IconMoon /> : <IconSun />}
        </span>
        <span className="theme-menu__trigger-label">
          {OPTIONS.find((o) => o.value === preference)?.label}
        </span>
        <span className="theme-menu__chevron" aria-hidden="true" />
      </button>

      {open
        ? createPortal(
            <ul
              className="theme-menu__list"
              role="listbox"
              aria-label="外观"
              style={{
                position: "fixed",
                bottom: pos.bottom,
                left: pos.left,
                top: "auto",
                right: "auto",
                zIndex: 9999,
              }}
            >
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
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
};
