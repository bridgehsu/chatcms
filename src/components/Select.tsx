import { useEffect, useRef, useState } from "react";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

interface Props<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  "aria-label"?: string;
  className?: string;
  /** 菜单展开方向，输入框旁用 top */
  placement?: "bottom" | "top";
}

/** 自定义下拉，避免原生 select 遮挡表单 */
export const Select = <T extends string>({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  className = "",
  placement = "bottom",
}: Props<T>) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

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

  const rootClass = [
    "ui-select",
    open ? "is-open" : "",
    placement === "top" ? "ui-select--up" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        className="ui-select__trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ui-select__value">{current?.label}</span>
        <span className="ui-select__chevron" aria-hidden="true" />
      </button>

      {open && (
        <ul className="ui-select__menu" role="listbox">
          {options.map((opt) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                className={`ui-select__option${opt.value === value ? " is-active" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
