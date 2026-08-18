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
import type { ProviderKind } from "@/types";
import type { ProviderProfile } from "./ModelsPanel";

type Tier = "local" | "cloud";

type FormState = {
  name: string;
  tier: Tier;
  kind: ProviderKind;
  familyId: FamilyId;
  versionId: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  weight: number;
  contextWindow: number;
  enabled: boolean;
};

const LOCAL_BASE_URL = "http://localhost:11434/v1";

const emptyForm = (): FormState => {
  const family = getFamily("claude");
  const version = family.versions[0];
  return {
    name: "",
    tier: "cloud",
    kind: family.kind,
    familyId: family.id as FamilyId,
    versionId: version.id,
    apiKey: "",
    model: version.model,
    baseUrl: family.baseUrl,
    weight: 2,
    contextWindow: 200000,
    enabled: true,
  };
};

const fromProfile = (p: ProviderProfile): FormState => {
  const matched = matchFamilyVersion(p.kind, p.model, p.base_url ?? "");
  return {
    name: p.name,
    tier: p.tier,
    kind: p.kind,
    familyId: matched.familyId,
    versionId: matched.versionId,
    apiKey: p.api_key,
    model: p.model,
    baseUrl: p.base_url ?? "",
    weight: p.weight,
    contextWindow: p.context_window,
    enabled: p.enabled,
  };
};

const TIER_OPTIONS = [
  { value: "cloud" as Tier, label: "云端 (cloud)" },
  { value: "local" as Tier, label: "本地 (local)" },
];

const KIND_OPTIONS = [
  { value: "anthropic" as ProviderKind, label: "anthropic" },
  { value: "openai" as ProviderKind, label: "openai" },
];

const WEIGHT_OPTIONS = [
  { value: "1", label: "1 - 兜底" },
  { value: "2", label: "2 - 普通" },
  { value: "3", label: "3 - 优先" },
  { value: "4", label: "4 - 最高" },
];

type Props = {
  mode: "add" | "edit";
  profile: ProviderProfile | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const ModelModal = ({ mode, profile, onClose, onSaved }: Props) => {
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

  /** 切换 tier：本地时自动填充默认值 */
  const applyTier = (tier: Tier) => {
    if (tier === "local") {
      setForm((prev) => ({
        ...prev,
        tier,
        kind: "openai",
        baseUrl: LOCAL_BASE_URL,
        contextWindow: prev.contextWindow === 200000 ? 8192 : prev.contextWindow,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        tier,
        contextWindow: prev.contextWindow === 8192 ? 200000 : prev.contextWindow,
      }));
    }
  };

  const applyFamily = (id: FamilyId) => {
    const family = getFamily(id);
    const version = family.versions[0];
    setForm((prev) => ({
      ...prev,
      familyId: id,
      versionId: version.id,
      kind: family.kind,
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
      kind: family.kind,
      baseUrl: family.baseUrl,
    }));
  };

  const save = async () => {
    setError("");
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      apiKey: form.apiKey,
      model: form.model.trim(),
      baseUrl: form.baseUrl.trim() || null,
      tier: form.tier,
      weight: form.weight,
      contextWindow: form.contextWindow,
    };
    try {
      if (mode === "edit" && profile) {
        await invoke("model_profile_update", {
          id: profile.id,
          ...payload,
          enabled: form.enabled,
        });
      } else {
        await invoke("model_profile_add", payload);
      }
      await onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const isCloud = form.tier === "cloud";

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
          {/* 名称 */}
          <div className="mcp-form-row">
            <label>名称</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：公司 Claude / 本地 Qwen"
            />
          </div>

          {/* 类型 tier */}
          <div className="mcp-form-row">
            <label>类型</label>
            <Select
              aria-label="选择部署类型"
              value={form.tier}
              options={TIER_OPTIONS}
              onChange={applyTier}
            />
          </div>

          {/* 协议 kind */}
          <div className="mcp-form-row">
            <label>协议</label>
            <Select
              aria-label="选择协议"
              value={form.kind}
              options={KIND_OPTIONS}
              onChange={(v) => setForm({ ...form, kind: v })}
            />
          </div>

          {/* 模型族 — 仅 cloud */}
          {isCloud && (
            <div className="mcp-form-row">
              <label>模型族</label>
              <Select
                aria-label="选择模型族"
                value={form.familyId}
                options={[...FAMILY_OPTIONS]}
                onChange={applyFamily}
              />
            </div>
          )}

          {/* 版本 — 仅 cloud */}
          {isCloud && (
            <div className="mcp-form-row">
              <label>版本</label>
              <Select
                aria-label="选择版本"
                value={form.versionId}
                options={getVersionOptions(form.familyId)}
                onChange={applyVersion}
              />
            </div>
          )}

          {/* API Key */}
          <div className="mcp-form-row">
            <label>API 密钥{isCloud ? "" : "（选填）"}</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={isCloud ? "sk-..." : "本地模型可留空"}
              autoComplete="off"
            />
          </div>

          {/* 模型 ID */}
          <div className="mcp-form-row">
            <label>模型 ID</label>
            <input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder={
                isCloud ? "claude-sonnet-4-6" : "qwen2.5:14b"
              }
            />
          </div>

          {/* 接口地址 */}
          <div className="mcp-form-row">
            <label>接口地址</label>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder={
                isCloud
                  ? "https://api.example.com"
                  : LOCAL_BASE_URL
              }
            />
          </div>

          {/* 权重 */}
          <div className="mcp-form-row">
            <label>权重</label>
            <Select
              aria-label="选择权重"
              value={String(form.weight)}
              options={WEIGHT_OPTIONS}
              onChange={(v) => setForm({ ...form, weight: Number(v) })}
            />
          </div>

          {/* Context 窗口 */}
          <div className="mcp-form-row">
            <label>
              Context 窗口
              {!isCloud && (
                <span className="mcp-form-hint">
                  （8B → 8192，14B → 16384）
                </span>
              )}
            </label>
            <input
              type="number"
              min={1024}
              step={1024}
              value={form.contextWindow}
              onChange={(e) =>
                setForm({ ...form, contextWindow: Number(e.target.value) })
              }
              placeholder="8192"
            />
          </div>

          {/* 启用状态（仅编辑模式） */}
          {mode === "edit" && (
            <div className="mcp-form-row">
              <label>状态</label>
              <label className="model-toggle">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm({ ...form, enabled: e.target.checked })
                  }
                />
                <span>{form.enabled ? "启用" : "禁用"}</span>
              </label>
            </div>
          )}

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
