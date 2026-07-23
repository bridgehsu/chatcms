import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { McpServerInfo } from "@/types";

export const McpPanel = () => {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", command: "", args: "", env: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = () =>
    invoke<McpServerInfo[]>("mcp_list").then(setServers).catch(console.error);

  useEffect(() => {
    refresh();
  }, []);

  const add = async () => {
    setError("");
    const args = form.args
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const env: Record<string, string> = {};
    for (const line of form.env.split("\n")) {
      const [k, ...rest] = line.split("=");
      if (k?.trim()) env[k.trim()] = rest.join("=").trim();
    }
    setBusy("add");
    try {
      await invoke("mcp_add", { name: form.name, command: form.command, args, env });
      setForm({ name: "", command: "", args: "", env: "" });
      setAdding(false);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (name: string) => {
    setBusy(name);
    await invoke("mcp_remove", { name }).catch(console.error);
    setBusy(null);
    refresh();
  };

  const reconnect = async (name: string) => {
    setBusy(`reconnect-${name}`);
    await invoke("mcp_reconnect", { name }).catch(console.error);
    setBusy(null);
    refresh();
  };

  return (
    <div className="mcp-panel">
      <div className="mcp-header">
        <span className="mcp-title">MCP 服务器</span>
        <button className="btn-mcp-add" onClick={() => setAdding(true)} type="button">
          + 添加服务器
        </button>
      </div>

      {servers.length === 0 && !adding && (
        <p className="mcp-empty">尚未配置 MCP 服务器</p>
      )}

      <div className="mcp-server-list">
        {servers.map((s) => (
          <div key={s.name} className="mcp-server-row">
            <div className="mcp-server-left">
              <span className={`mcp-dot ${s.status.state}`} />
              <div>
                <div className="mcp-server-name">{s.name}</div>
                <div className="mcp-server-cmd">
                  {s.config.command} {s.config.args.join(" ")}
                </div>
                <div className="mcp-server-status">
                  {s.status.state === "connected" &&
                    `${s.status.tools} 个工具`}
                  {s.status.state === "error" && (
                    <span className="mcp-error-msg">{s.status.message}</span>
                  )}
                  {s.status.state === "disconnected" && "已断开"}
                </div>
              </div>
            </div>
            <div className="mcp-server-actions">
              <button
                className="btn-mcp-action"
                onClick={() => void reconnect(s.name)}
                disabled={busy === `reconnect-${s.name}`}
                type="button"
              >
                {busy === `reconnect-${s.name}` ? "…" : "重连"}
              </button>
              <button
                className="btn-mcp-remove"
                onClick={() => void remove(s.name)}
                disabled={busy === s.name}
                type="button"
              >
                {busy === s.name ? "…" : "移除"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <div className="mcp-add-form">
          <div className="mcp-form-row">
            <label>名称</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="my-server"
            />
          </div>
          <div className="mcp-form-row">
            <label>命令</label>
            <input
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              placeholder="npx / uvx / python"
            />
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
            <label>环境变量（每行 KEY=VALUE）</label>
            <textarea
              className="mcp-env-input"
              value={form.env}
              onChange={(e) => setForm({ ...form, env: e.target.value })}
              placeholder={"API_KEY=xxx\nSOME_VAR=yyy"}
              rows={3}
            />
          </div>
          {error && <div className="mcp-form-error">{error}</div>}
          <div className="modal-actions" style={{ marginTop: 0 }}>
            <button
              onClick={() => {
                setAdding(false);
                setError("");
              }}
              type="button"
            >
              取消
            </button>
            <button
              className="btn-primary"
              onClick={() => void add()}
              disabled={!form.name || !form.command || busy === "add"}
              type="button"
            >
              {busy === "add" ? "连接中…" : "添加并连接"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
