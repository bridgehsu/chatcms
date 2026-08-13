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
    invoke<ProviderProfile[]>("provider_list")
      .then(setProfiles)
      .catch(console.error);
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

  const label = autoModel
    ? "Auto"
    : (active?.name ?? "选择模型");

  const select = async (id: string) => {
    await invoke("provider_activate", { id });
    await load();
    refresh();
    onAutoChange(false);
    writeAuto(false);
    setOpen(false);
  };

  const selectAuto = () => {
    onAutoChange(true);
    writeAuto(true);
    setOpen(false);
  };

  return (
    <div className="model-picker" ref={rootRef}>
      <button
        type="button"
        className={`model-picker__trigger${autoModel ? " is-auto" : ""}`}
        onClick={() => { if (open) { setOpen(false); } else { refresh(); setOpen(true); } }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {autoModel && <span className="model-picker__dot" aria-hidden="true" />}
        <span>{label}</span>
        <svg className="model-picker__chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="model-picker__menu" role="listbox">
          {/* Auto */}
          <button
            type="button"
            role="option"
            aria-selected={autoModel}
            className={`model-picker__option model-picker__option--auto${autoModel ? " is-selected" : ""}`}
            onClick={selectAuto}
          >
            <span className="model-picker__option-dot" />
            <div className="model-picker__option-main">
              <span className="model-picker__option-name">Auto</span>
              <span className="model-picker__option-desc">由系统自动选择最佳模型</span>
            </div>
          </button>

          {profiles.length > 0 && <div className="model-picker__sep" />}

          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={!autoModel && p.active}
              className={`model-picker__option${!autoModel && p.active ? " is-selected" : ""}`}
              onClick={() => void select(p.id)}
            >
              <div className="model-picker__option-main">
                <span className="model-picker__option-name">{p.name}</span>
                <span className="model-picker__option-desc">{p.model}</span>
              </div>
              <span className="model-picker__option-provider">
                {p.kind === "anthropic" ? "Anthropic" : "OpenAI"}
              </span>
            </button>
          ))}

          {profiles.length === 0 && (
            <div className="model-picker__empty">
              暂无配置，请到「模型」页添加
            </div>
          )}
        </div>
      )}
    </div>
  );
};
