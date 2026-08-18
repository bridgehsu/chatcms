import { useEffect, useRef, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import { useProviderStore } from "@/stores/useProviderStore";
import type { ProviderProfile } from "@/types";

const AUTO_KEY = "chatcms.autoModel";

export function readAuto() {
  try { return localStorage.getItem(AUTO_KEY) !== "0"; } catch { return true; }
}
function writeAuto(v: boolean) {
  try { localStorage.setItem(AUTO_KEY, v ? "1" : "0"); } catch { /* */ }
}

type Props = {
  autoModel: boolean;
  onAutoChange: (v: boolean) => void;
};

export const ModelPicker = ({ autoModel, onAutoChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const load = useProviderStore((s) => s.load);

  const refresh = () => {
    invoke<ProviderProfile[]>("provider_list").then(setProfiles).catch(console.error);
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = profiles.find((p) => p.active);
  const label = autoModel ? "Auto" : (active?.name ?? "选择模型");

  const pickAuto = () => {
    invoke("provider_set_auto").catch(console.error);
    onAutoChange(true);
    writeAuto(true);
    setOpen(false);
  };

  const pickProfile = async (id: string) => {
    await invoke("provider_activate", { id });
    await load();
    refresh();
    onAutoChange(false);
    writeAuto(false);
    setOpen(false);
  };

  return (
    <div className="model-picker" ref={rootRef}>
      <button
        type="button"
        className="model-picker__trigger"
        onClick={() => { refresh(); setOpen((v) => !v); }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <svg className="model-picker__chevron" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {open && (
        <ul className="model-picker__menu" role="listbox" aria-label="选择模型">
          {/* Auto */}
          <li role="option" aria-selected={autoModel}>
            <button
              type="button"
              className={`model-picker__item${autoModel ? " is-active" : ""}`}
              onClick={pickAuto}
            >
              <span className="model-picker__item-label">Auto</span>
              {autoModel && <CheckIcon />}
            </button>
          </li>

          {profiles.length > 0 && (
            <li role="separator" className="model-picker__divider" />
          )}

          {profiles.map((p) => {
            const selected = !autoModel && p.active;
            return (
              <li key={p.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`model-picker__item${selected ? " is-active" : ""}`}
                  onClick={() => void pickProfile(p.id)}
                >
                  <span className="model-picker__item-label">{p.name}</span>
                  <span className="model-picker__item-sub">{p.model}</span>
                  {selected && <CheckIcon />}
                </button>
              </li>
            );
          })}

          {profiles.length === 0 && (
            <li className="model-picker__empty">暂无配置，请到「模型」页添加</li>
          )}
        </ul>
      )}
    </div>
  );
};

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="model-picker__check">
    <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
