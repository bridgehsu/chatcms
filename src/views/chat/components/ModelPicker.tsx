import { useEffect, useRef, useState } from "react";
import { invoke } from "@/hooks/useTauri";

interface Profile {
  id: string;
  name: string;
  model: string;
  tier: string;
  enabled: boolean;
}

const STORAGE_KEY = "chatcms.activeProfileId";

export function readActiveProfileId(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

/** @deprecated Use readActiveProfileId instead */
export function readAuto(): boolean {
  return readActiveProfileId() === null;
}

type Props = {
  autoModel: boolean;
  onAutoChange: (v: boolean) => void;
};

export const ModelPicker = ({ autoModel, onAutoChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    invoke<Profile[]>("model_profile_list")
      .then((list) => setProfiles(list.filter((p) => p.enabled)))
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

  const activeId = autoModel ? null : readActiveProfileId();
  const active = profiles.find((p) => p.id === activeId);
  const label = autoModel ? "Auto" : (active?.name ?? "选择模型");

  const pickAuto = () => {
    invoke("model_profile_activate", { id: null }).catch(console.error);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    onAutoChange(true);
    setOpen(false);
  };

  const pickProfile = (id: string) => {
    invoke("model_profile_activate", { id }).catch(console.error);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* */ }
    onAutoChange(false);
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
            const selected = !autoModel && p.id === activeId;
            return (
              <li key={p.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`model-picker__item${selected ? " is-active" : ""}`}
                  onClick={() => pickProfile(p.id)}
                >
                  <span className="model-picker__item-label">{p.name}</span>
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
