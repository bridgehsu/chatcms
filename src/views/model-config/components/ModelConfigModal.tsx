import { useEffect, useState } from "react";
import { Select } from "@/components/Select";
import {
  FAMILY_OPTIONS,
  getFamily,
  getVersion,
  getVersionOptions,
  matchFamilyVersion,
  type FamilyId,
} from "@/config/modelPresets";
import { invoke } from "@/hooks/useTauri";
import type { ProviderKind, ProviderProfile } from "@/types";

type FormState = {
  name: string;
  familyId: FamilyId;
  versionId: string;
  apiKey: string;
  model: string;
  provider: ProviderKind;
  baseUrl: string;
};

const emptyForm = (): FormState => {
  const family = getFamily("claude");
  const version = family.versions[0];
  return {
    name: "",
    familyId: family.id as FamilyId,
    versionId: version.id,
    apiKey: "",
    model: version.model,
    provider: family.kind,
    baseUrl: family.baseUrl,
  };
};

const fromProfile = (p: ProviderProfile): FormState => {
  const matched = matchFamilyVersion(p.kind, p.model, p.base_url ?? "");
  return {
    name: p.name,
    familyId: matched.familyId,
    versionId: matched.versionId,
    apiKey: p.api_key,
    model: p.model,
    provider: p.kind,
    baseUrl: p.base_url ?? "",
  };
};

type Props = {
  mode: "add" | "edit";
  profile: ProviderProfile | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const ModelConfigModal = ({ mode, profile, onClose, onSaved }: Props) => {
  const [form, setForm] = useState<FormState>(
    mode === "edit" && profile ? fromProfile(profile) : emptyForm(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(mode === "edit" && profile ? fromProfile(profile) : emptyForm());
    setError("");
  }, [mode, profile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const applyFamily = (id: FamilyId) => {
    const family = getFamily(id);
    const version = family.versions[0];
    setForm((prev) => ({
      ...prev,
      familyId: id,
      versionId: version.id,
      provider: family.kind,
      model: version.model,
      baseUrl: family.baseUrl,
    }));
  };

  const applyVersion = (id: string) => {
    const version = getVersion(form.familyId, id);
    const family = getFamily(form.familyId);
    setForm((prev) => ({
      ...prev,
      versionId: version.id,
      model: version.model,
      provider: family.kind,
      baseUrl: family.baseUrl,
    }));
  };

  const save = async () => {
    setError("");
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      provider: form.provider,
      apiKey: form.apiKey,
      model: form.model.trim(),
      baseUrl: form.baseUrl.trim() || null,
    };
    try {
      if (mode === "edit" && profile) {
        await invoke("provider_update", { id: profile.id, ...payload });
      } else {
        await invoke("provider_add", payload);
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
        aria-labelledby="model-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="model-modal-title" className="model-modal__title">
            {mode === "edit" ? "编辑模型配置" : "添加模型配置"}
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
              placeholder="例如：公司 Claude / 个人 DeepSeek"
            />
          </div>
          <div className="mcp-form-row">
            <label>模型族</label>
            <Select
              aria-label="选择模型族"
              value={form.familyId}
              options={[...FAMILY_OPTIONS]}
              onChange={applyFamily}
            />
          </div>
          <div className="mcp-form-row">
            <label>版本</label>
            <Select
              aria-label="选择版本"
              value={form.versionId}
              options={getVersionOptions(form.familyId)}
              onChange={applyVersion}
            />
          </div>
          <div className="mcp-form-row">
            <label>API 密钥</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..."
              autoComplete="off"
            />
          </div>
          <div className="mcp-form-row">
            <label>模型 ID</label>
            <input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="模型名称"
            />
          </div>
          <div className="mcp-form-row">
            <label>接口地址</label>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.example.com"
            />
          </div>
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
            disabled={!form.name.trim() || !form.model.trim() || busy}
          >
            {busy ? "保存中…" : mode === "edit" ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
};
