import { useEffect, useState } from "react";
import { Select } from "@/components/Select";
import { MCP_PRESETS } from "@/config/mcpPresets";
import { invoke } from "@/hooks/useTauri";
import type { McpServerInfo } from "@/types";

type FormState = {
  name: string;
  command: string;
  args: string;
  env: string;
  cwd: string;
  description: string;
  enabled: boolean;
  presetId: string;
};

const emptyForm = (): FormState => ({
  name: "",
  command: "npx",
  args: "",
  env: "",
  cwd: "",
  description: "",
  enabled: true,
  presetId: "",
});

const fromServer = (s: McpServerInfo): FormState => {
  const envLines = Object.entries(s.config.env ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  return {
    name: s.name,
    command: s.config.command,
    args: (s.config.args ?? []).join(" "),
    env: envLines,
    cwd: s.config.cwd ?? "",
    description: s.config.description ?? "",
    enabled: s.config.enabled !== false,
    presetId: "",
  };
};

const parseArgs = (raw: string) =>
  raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const parseEnv = (raw: string) => {
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const [k, ...rest] = line.split("=");
    if (k?.trim()) env[k.trim()] = rest.join("=").trim();
  }
  return env;
};

type Props = {
  mode: "add" | "edit";
  server: McpServerInfo | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const McpModal = ({ mode, server, onClose, onSaved }: Props) => {
  const [form, setForm] = useState<FormState>(
    mode === "edit" && server ? fromServer(server) : emptyForm(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(mode === "edit" && server ? fromServer(server) : emptyForm());
    setError("");
  }, [mode, server]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const applyPreset = (id: string) => {
    if (!id) {
      setForm((f) => ({ ...f, presetId: "" }));
      return;
    }
    const p = MCP_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setForm({
      name: p.name,
      command: p.command,
      args: p.args,
      env: p.env ?? "",
      cwd: p.cwd ?? "",
      description: p.description,
      enabled: true,
      presetId: id,
    });
  };

  const save = async () => {
    setError("");
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      command: form.command.trim(),
      args: parseArgs(form.args),
      env: parseEnv(form.env),
      cwd: form.cwd.trim() || null,
      description: form.description.trim(),
      enabled: form.enabled,
    };
    try {
      if (mode === "edit" && server) {
        await invoke("plugin:mcp|mcp_update", { ...payload, name: server.name });
      } else {
        await invoke("plugin:mcp|mcp_add", payload);
      }
      await onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const presetOptions = [
    { value: "", label: "自定义 / 不使用预设" },
    ...MCP_PRESETS.map((p) => ({ value: p.id, label: p.label })),
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal skill-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="mcp-modal-title" className="model-modal__title">
            {mode === "edit" ? "编辑 MCP 服务器" : "添加 MCP 服务器"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="model-modal__body">
          <p className="skill-modal__hint">
            本地 stdio 进程（command + args + env），对齐 OpenClaw{" "}
            <code>mcp.servers</code>
          </p>

          {mode === "add" && (
            <div className="mcp-form-row">
              <label>预设</label>
              <Select
                aria-label="选择预设"
                value={form.presetId}
                options={presetOptions}
                onChange={applyPreset}
              />
            </div>
          )}

          <div className="agent-form-grid">
            <div className="mcp-form-row">
              <label>名称</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="filesystem"
                disabled={mode === "edit"}
              />
            </div>
            <div className="mcp-form-row">
              <label>命令</label>
              <input
                value={form.command}
                onChange={(e) => setForm({ ...form, command: e.target.value })}
                placeholder="npx / uvx / node"
              />
            </div>
          </div>

          <div className="mcp-form-row">
            <label>参数（空格分隔）</label>
            <input
              value={form.args}
              onChange={(e) => setForm({ ...form, args: e.target.value })}
              placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
            />
          </div>

          <div className="mcp-form-row">
            <label>说明</label>
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="用途简述"
            />
          </div>

          <div className="mcp-form-row">
            <label>工作目录（可选）</label>
            <input
              value={form.cwd}
              onChange={(e) => setForm({ ...form, cwd: e.target.value })}
              placeholder="/path/to/workdir"
            />
          </div>

          <div className="mcp-form-row">
            <label>环境变量（每行 KEY=VALUE）</label>
            <textarea
              className="skill-body"
              rows={4}
              value={form.env}
              onChange={(e) => setForm({ ...form, env: e.target.value })}
              placeholder={"API_KEY=xxx\nGITHUB_PERSONAL_ACCESS_TOKEN="}
            />
          </div>

          <label className="account-enabled">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <span>启用并连接</span>
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
            disabled={!form.name.trim() || !form.command.trim() || busy}
          >
            {busy
              ? mode === "edit"
                ? "保存中…"
                : "连接中…"
              : mode === "edit"
                ? "保存"
                : "添加并连接"}
          </button>
        </div>
      </div>
    </div>
  );
};
