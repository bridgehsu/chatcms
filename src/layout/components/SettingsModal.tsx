import { useEffect, useState } from "react";
import {
  IconChannels,
  IconMemory,
  IconProvider,
} from "@/components/icons";
import { Select } from "@/components/Select";
import { invoke } from "@/hooks/useTauri";
import type { AppConfig, ProviderKind } from "@/types";
import { KnowledgePanel } from "@/views/settings/components/KnowledgePanel";
import { ChannelPanel } from "@/views/settings/components/ChannelPanel";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "provider" | "knowledge" | "channels";

/** 5 个常用模型预设（DeepSeek / Kimi 等走 OpenAI 兼容协议） */
const MODEL_PRESETS = [
  {
    id: "claude",
    label: "Claude（Anthropic）",
    kind: "anthropic" as const,
    model: "claude-sonnet-4-6",
    baseUrl: "https://api.anthropic.com",
  },
  {
    id: "openai",
    label: "GPT（OpenAI）",
    kind: "openai" as const,
    model: "gpt-4o",
    baseUrl: "https://api.openai.com",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai" as const,
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
  },
  {
    id: "kimi",
    label: "Kimi（月之暗面）",
    kind: "openai" as const,
    model: "moonshot-v1-8k",
    baseUrl: "https://api.moonshot.cn",
  },
  {
    id: "qwen",
    label: "通义千问",
    kind: "openai" as const,
    model: "qwen-plus",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
  },
] as const;

type PresetId = (typeof MODEL_PRESETS)[number]["id"];

const PRESET_OPTIONS = MODEL_PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
}));

const matchPreset = (kind: ProviderKind, model: string, baseUrl: string): PresetId => {
  const normalized = baseUrl.replace(/\/$/, "");
  const found = MODEL_PRESETS.find(
    (p) =>
      p.kind === kind &&
      p.model === model &&
      p.baseUrl.replace(/\/$/, "") === normalized,
  );
  if (found) return found.id;
  // 宽松匹配：同模型名
  const byModel = MODEL_PRESETS.find((p) => p.model === model);
  return byModel?.id ?? "claude";
};

const TABS: { key: Tab; label: string; Icon: typeof IconProvider }[] = [
  { key: "provider", label: "模型", Icon: IconProvider },
  { key: "knowledge", label: "记忆", Icon: IconMemory },
  { key: "channels", label: "渠道", Icon: IconChannels },
];

/** 系统设置弹窗（偏好设置式布局） */
export const SettingsModal = ({ open, onClose }: Props) => {
  const [tab, setTab] = useState<Tab>("provider");
  const [presetId, setPresetId] = useState<PresetId>("claude");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [provider, setProvider] = useState<ProviderKind>("anthropic");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void invoke<AppConfig>("config_get").then((cfg) => {
      setApiKey(cfg.provider.api_key);
      setModel(cfg.provider.model);
      setProvider(cfg.provider.kind);
      setBaseUrl(cfg.provider.base_url ?? "");
      setPresetId(
        matchPreset(
          cfg.provider.kind,
          cfg.provider.model,
          cfg.provider.base_url ?? "",
        ),
      );
    });
  }, [open]);

  const applyPreset = (id: PresetId) => {
    const preset = MODEL_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setProvider(preset.kind);
    setModel(preset.model);
    setBaseUrl(preset.baseUrl);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const save = async () => {
    setSaving(true);
    try {
      await invoke("config_set", { apiKey, model, provider, baseUrl: baseUrl || null });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const confirm = () => {
    if (tab === "provider") {
      void save();
      return;
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="settings-modal__titlebar">
          <div className="settings-modal__traffic">
            <button
              type="button"
              className="traffic-btn traffic-btn--close"
              aria-label="关闭"
              onClick={onClose}
            />
            <button
              type="button"
              className="traffic-btn traffic-btn--min"
              aria-label="最小化"
              tabIndex={-1}
            />
            <button
              type="button"
              className="traffic-btn traffic-btn--max"
              aria-label="最大化"
              tabIndex={-1}
            />
          </div>
          <h2 id="settings-title" className="settings-modal__window-title">
            设置
          </h2>
          <div className="settings-modal__titlebar-spacer" aria-hidden="true" />
        </div>

        <div className="settings-modal__toolbar" role="tablist">
          {TABS.map((t) => {
            const { Icon } = t;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`settings-modal__tab${tab === t.key ? " is-active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                <span className="settings-modal__tab-icon">
                  <Icon />
                </span>
                <span className="settings-modal__tab-label">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="settings-modal__body">
          {tab === "provider" && (
            <div className="prefs-form">
              <div className="prefs-row">
                <span className="prefs-label">模型：</span>
                <div className="prefs-control">
                  <Select
                    aria-label="模型"
                    value={presetId}
                    options={PRESET_OPTIONS}
                    onChange={applyPreset}
                  />
                </div>
              </div>

              <div className="prefs-row">
                <span className="prefs-label">API 密钥：</span>
                <div className="prefs-control">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="prefs-row">
                <span className="prefs-label">模型 ID：</span>
                <div className="prefs-control">
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="模型名称"
                  />
                </div>
              </div>

              <div className="prefs-row">
                <span className="prefs-label">接口地址：</span>
                <div className="prefs-control">
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.example.com"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === "knowledge" && <KnowledgePanel />}
          {tab === "channels" && <ChannelPanel />}
        </div>

        <footer className="settings-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={confirm}
            disabled={saving}
          >
            {saving ? "保存中…" : "好"}
          </button>
        </footer>
      </div>
    </div>
  );
};
