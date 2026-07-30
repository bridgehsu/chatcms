import { useEffect, useState } from "react";
import { Select } from "@/components/Select";
import {
  PLATFORM_OPTIONS,
  getPlatform,
  type PlatformId,
} from "@/config/platformPresets";
import { invoke } from "@/hooks/useTauri";
import type { PlatformAccount } from "@/types";

type FormState = {
  name: string;
  platform: PlatformId;
  accountId: string;
  accessKey: string;
  secretKey: string;
  enabled: boolean;
  notes: string;
};

const emptyForm = (): FormState => ({
  name: "",
  platform: "wechat_mp",
  accountId: "",
  accessKey: "",
  secretKey: "",
  enabled: true,
  notes: "",
});

const fromAccount = (a: PlatformAccount): FormState => ({
  name: a.name,
  platform: (a.platform as PlatformId) || "custom",
  accountId: a.account_id,
  accessKey: a.access_key,
  secretKey: a.secret_key,
  enabled: a.enabled,
  notes: a.notes,
});

type Props = {
  mode: "add" | "edit";
  account: PlatformAccount | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const AccountModal = ({ mode, account, onClose, onSaved }: Props) => {
  const [form, setForm] = useState<FormState>(
    mode === "edit" && account ? fromAccount(account) : emptyForm(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(mode === "edit" && account ? fromAccount(account) : emptyForm());
    setError("");
  }, [mode, account]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preset = getPlatform(form.platform);

  const save = async () => {
    setError("");
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      platform: form.platform,
      accountId: form.accountId.trim(),
      accessKey: form.accessKey,
      secretKey: form.secretKey,
      enabled: form.enabled,
      notes: form.notes.trim(),
    };
    try {
      if (mode === "edit" && account) {
        await invoke("plugin:accounts|account_update", { id: account.id, ...payload });
      } else {
        await invoke("plugin:accounts|account_add", payload);
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
        className="model-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="account-modal-title" className="model-modal__title">
            {mode === "edit" ? "编辑账号" : "添加账号"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="model-modal__body">
          <div className="mcp-form-row">
            <label>名称</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：品牌官号 / 个人号"
            />
          </div>
          <div className="mcp-form-row">
            <label>平台</label>
            <Select
              aria-label="选择平台"
              value={form.platform}
              options={[...PLATFORM_OPTIONS]}
              onChange={(platform) => setForm({ ...form, platform })}
            />
          </div>
          <div className="mcp-form-row">
            <label>{preset.accountIdLabel}</label>
            <input
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              placeholder={preset.accountIdPlaceholder}
            />
          </div>
          <div className="mcp-form-row">
            <label>{preset.accessKeyLabel}</label>
            <input
              type="password"
              value={form.accessKey}
              onChange={(e) => setForm({ ...form, accessKey: e.target.value })}
              placeholder={preset.accessKeyPlaceholder}
              autoComplete="off"
            />
          </div>
          <div className="mcp-form-row">
            <label>{preset.secretKeyLabel}</label>
            <input
              type="password"
              value={form.secretKey}
              onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
              placeholder={preset.secretKeyPlaceholder}
              autoComplete="off"
            />
          </div>
          <div className="mcp-form-row">
            <label>备注</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="用途说明、负责人等"
            />
          </div>
          <label className="account-enabled">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <span>启用此账号</span>
          </label>
          {error && <div className="mcp-form-error">{error}</div>}
        </div>

        <div className="model-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={!form.name.trim() || busy}
          >
            {busy ? "保存中…" : mode === "edit" ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
};
