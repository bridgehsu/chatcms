import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { DomainPolicy, PermissionMode } from "@/types";
import {
  DOMAIN_POLICIES,
  DOMAIN_POLICY_LABEL,
  PERMISSION_DOMAINS,
  defaultDomainPolicies,
} from "@/utils/permissionDomains";

type Props = {
  mode: "add" | "edit";
  editing: PermissionMode | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const PermissionModeModal = ({
  mode,
  editing,
  onClose,
  onSaved,
}: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domains, setDomains] =
    useState<Record<string, DomainPolicy>>(defaultDomainPolicies);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "edit" && editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setDomains({ ...defaultDomainPolicies(), ...editing.domains });
    } else {
      setName("");
      setDescription("");
      setDomains(defaultDomainPolicies());
    }
    setError("");
  }, [mode, editing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "edit" && editing) {
        await invoke("permission_mode_update", {
          id: editing.id,
          name: name.trim(),
          description: description.trim(),
          domains,
        });
      } else {
        await invoke("permission_mode_add", {
          name: name.trim(),
          description: description.trim(),
          domains,
        });
      }
      await onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal skill-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="perm-mode-title"
      >
        <div className="model-modal__header">
          <h2 id="perm-mode-title" className="model-modal__title">
            {mode === "edit" ? "编辑权限模式" : "新建权限模式"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="model-modal__body">
          <div className="mcp-form-row">
            <label>名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：只读模式"
            />
          </div>
          <div className="mcp-form-row">
            <label>说明</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="一句话描述适用场景"
            />
          </div>

          <div className="mcp-form-row">
            <label>域策略</label>
            <ul className="permission-policy-list">
              {PERMISSION_DOMAINS.map((d) => (
                <li key={d.id} className="permission-policy-row">
                  <div className="permission-policy-row__meta">
                    <span className="permission-policy-row__name">{d.label}</span>
                    <span className="permission-policy-row__hint">
                      {d.toolHint}
                    </span>
                  </div>
                  <div className="perm-seg perm-seg--policy" role="group">
                    {DOMAIN_POLICIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`perm-seg__btn perm-seg__btn--${p}${domains[d.id] === p ? " is-active" : ""}`}
                        onClick={() =>
                          setDomains((prev) => ({ ...prev, [d.id]: p }))
                        }
                      >
                        {DOMAIN_POLICY_LABEL[p]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {error ? <div className="mcp-form-error">{error}</div> : null}
        </div>

        <div className="model-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!name.trim() || busy}
            onClick={() => void save()}
          >
            {busy ? "保存中…" : mode === "edit" ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
};
