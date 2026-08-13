import { useEffect, useRef, useState } from "react";
import { MODEL_FAMILIES } from "@/config/modelPresets";
import type { FamilyId } from "@/config/modelPresets";

const AUTO_KEY = "chatcms.autoModel";

function readAuto() {
  try { return localStorage.getItem(AUTO_KEY) !== "0"; } catch { return true; }
}
function writeAuto(v: boolean) {
  try { localStorage.setItem(AUTO_KEY, v ? "1" : "0"); } catch { /* */ }
}

type Props = {
  familyId: FamilyId;
  versionId: string;
  autoModel: boolean;
  onSelectFamily: (id: FamilyId) => void;
  onSelectVersion: (id: string) => void;
  onAutoChange: (v: boolean) => void;
};

export const ModelPicker = ({
  familyId,
  versionId,
  autoModel,
  onSelectFamily,
  onSelectVersion,
  onAutoChange,
}: Props) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const family = MODEL_FAMILIES.find((f) => f.id === familyId) ?? MODEL_FAMILIES[0];
  const version = family.versions.find((v) => v.id === versionId) ?? family.versions[0];

  const label = autoModel ? "Auto" : `${family.label} · ${version.label}`;

  const select = (fid: FamilyId, vid: string) => {
    onSelectFamily(fid);
    onSelectVersion(vid);
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
        onClick={() => setOpen((v) => !v)}
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
          {/* Auto 选项 */}
          <button
            type="button"
            role="option"
            aria-selected={autoModel}
            className={`model-picker__option model-picker__option--auto${autoModel ? " is-selected" : ""}`}
            onClick={selectAuto}
          >
            <span className="model-picker__option-dot" />
            <span className="model-picker__option-name">Auto</span>
            <span className="model-picker__option-desc">由系统自动选择最佳模型</span>
          </button>

          <div className="model-picker__sep" />

          {/* 模型列表 */}
          {MODEL_FAMILIES.map((fam) =>
            fam.versions.map((ver) => {
              const selected = !autoModel && fam.id === familyId && ver.id === versionId;
              return (
                <button
                  key={`${fam.id}-${ver.id}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`model-picker__option${selected ? " is-selected" : ""}`}
                  onClick={() => select(fam.id as FamilyId, ver.id)}
                >
                  <span className="model-picker__option-name">{ver.label}</span>
                  <span className="model-picker__option-provider">{fam.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export { readAuto };
