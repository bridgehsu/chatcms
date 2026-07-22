import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, ProviderKind } from "../types";
import { McpPanel } from "./McpPanel";
import { KnowledgePanel } from "./KnowledgePanel";
import { ChannelPanel } from "./ChannelPanel";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "provider" | "mcp" | "knowledge" | "channels";

export function SettingsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("provider");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [provider, setProvider] = useState<ProviderKind>("anthropic");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    invoke<AppConfig>("config_get").then((cfg) => {
      setApiKey(cfg.provider.api_key);
      setModel(cfg.provider.model);
      setProvider(cfg.provider.kind);
      setBaseUrl(cfg.provider.base_url ?? "");
    });
  }, [open]);

  const save = async () => {
    setSaving(true);
    await invoke("config_set", { apiKey, model, provider, baseUrl: baseUrl || null });
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "provider", label: "Provider" },
    { key: "mcp", label: "MCP" },
    { key: "knowledge", label: "Memory" },
    { key: "channels", label: "Channels" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="settings-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`settings-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "provider" && (
          <>
            <label>Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderKind)}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI (compatible)</option>
            </select>

            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />

            <label>Model</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="claude-sonnet-4-6"
            />

            <label>Base URL (optional)</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.anthropic.com"
            />

            <div className="modal-actions">
              <button onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}

        {tab === "mcp" && (
          <>
            <McpPanel />
            <div className="modal-actions">
              <button onClick={onClose}>Close</button>
            </div>
          </>
        )}

        {tab === "knowledge" && (
          <>
            <KnowledgePanel />
            <div className="modal-actions">
              <button onClick={onClose}>Close</button>
            </div>
          </>
        )}

        {tab === "channels" && (
          <>
            <ChannelPanel />
            <div className="modal-actions">
              <button onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
