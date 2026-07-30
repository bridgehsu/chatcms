import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Select } from "@/components/Select";
import { invoke } from "@/hooks/useTauri";
import type { McpServerInfo, McpStatus } from "@/types";
import { McpModal } from "./McpModal";
import { McpToolsModal } from "./McpToolsModal";

const ALL = "all" as const;

const statusLabel = (s: McpStatus) => {
  if (s.state === "connected") return `已连接 · ${s.tools} 工具`;
  if (s.state === "error") return "错误";
  return "未连接";
};

const statusClass = (s: McpStatus) => {
  if (s.state === "connected") return "mcp-badge mcp-badge--ok";
  if (s.state === "error") return "mcp-badge mcp-badge--err";
  return "mcp-badge";
};

export const McpPanel = () => {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<McpServerInfo | null>(null);
  const [toolsFor, setToolsFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const list = await invoke<McpServerInfo[]>("plugin:mcp|mcp_list");
    setServers(list);
  };

  useEffect(() => {
    void refresh().catch(console.error);
  }, []);

  const statusOptions = useMemo(
    () => [
      { value: ALL, label: "全部状态" },
      { value: "connected", label: "已连接" },
      { value: "disconnected", label: "未连接" },
      { value: "error", label: "错误" },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return servers.filter((s) => {
      if (statusFilter !== ALL && s.status.state !== statusFilter) return false;
      if (!q) return true;
      const cmd = `${s.config.command} ${(s.config.args ?? []).join(" ")}`;
      return [s.name, s.config.description ?? "", cmd]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [servers, statusFilter, query]);

  const openAdd = () => {
    setError("");
    setEditing(null);
    setMode("add");
  };

  const openEdit = (s: McpServerInfo) => {
    setError("");
    setEditing(s);
    setMode("edit");
  };

  const closeModal = () => {
    setMode("idle");
    setEditing(null);
    setError("");
  };

  const remove = async (name: string, e: MouseEvent) => {
    e.stopPropagation();
    setBusy(`remove-${name}`);
    setError("");
    try {
      await invoke("plugin:mcp|mcp_remove", { name });
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const reconnect = async (name: string, e: MouseEvent) => {
    e.stopPropagation();
    setBusy(`reconnect-${name}`);
    setError("");
    try {
      await invoke("plugin:mcp|mcp_reconnect", { name });
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (name: string, e: MouseEvent) => {
    e.stopPropagation();
    setBusy(`disconnect-${name}`);
    setError("");
    try {
      await invoke("plugin:mcp|mcp_disconnect", { name });
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="model-panel">
      <div className="model-toolbar">
        <div className="model-filters">
          <div className="model-filter model-filter--family">
            <Select
              aria-label="筛选状态"
              value={statusFilter}
              options={statusOptions}
              onChange={setStatusFilter}
            />
          </div>
          <div className="model-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索名称、命令、说明…"
              aria-label="搜索 MCP"
            />
          </div>
        </div>
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 添加服务器
        </button>
      </div>

      {error && <div className="mcp-form-error">{error}</div>}

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th className="model-table__idx">#</th>
              <th>名称</th>
              <th>命令</th>
              <th>状态</th>
              <th>启用</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="model-table__empty">
                  {servers.length === 0
                    ? "尚未配置 MCP 服务器，可从预设快速添加"
                    : "没有匹配的服务器"}
                </td>
              </tr>
            ) : (
              filtered.map((s, index) => (
                <tr
                  key={s.name}
                  className="model-table__row"
                  onClick={() => openEdit(s)}
                >
                  <td className="model-table__idx model-table__mono">
                    {index + 1}
                  </td>
                  <td>
                    <span className="model-table__name">{s.name}</span>
                    {s.config.description ? (
                      <div className="account-table__notes">
                        {s.config.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="model-table__mono model-table__url">
                    {s.config.command} {(s.config.args ?? []).join(" ")}
                  </td>
                  <td>
                    <span className={statusClass(s.status)}>
                      {statusLabel(s.status)}
                    </span>
                    {s.status.state === "error" ? (
                      <div className="account-table__notes mcp-error-msg">
                        {s.status.message}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {s.config.enabled !== false ? (
                      <span className="model-status-idle">是</span>
                    ) : (
                      <span className="model-status-idle">否</span>
                    )}
                  </td>
                  <td>
                    <div
                      className="model-table__actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {s.status.state === "connected" && (
                        <button
                          className="btn-mcp-action"
                          onClick={() => setToolsFor(s.name)}
                          type="button"
                        >
                          工具
                        </button>
                      )}
                      {s.status.state === "connected" ? (
                        <button
                          className="btn-mcp-action"
                          onClick={(e) => void disconnect(s.name, e)}
                          disabled={busy === `disconnect-${s.name}`}
                          type="button"
                        >
                          {busy === `disconnect-${s.name}` ? "…" : "断开"}
                        </button>
                      ) : (
                        <button
                          className="btn-mcp-action"
                          onClick={(e) => void reconnect(s.name, e)}
                          disabled={
                            busy === `reconnect-${s.name}` ||
                            s.config.enabled === false
                          }
                          type="button"
                        >
                          {busy === `reconnect-${s.name}` ? "…" : "连接"}
                        </button>
                      )}
                      <button
                        className="btn-mcp-action"
                        onClick={() => openEdit(s)}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        className="btn-mcp-remove"
                        onClick={(e) => void remove(s.name, e)}
                        disabled={busy === `remove-${s.name}`}
                        type="button"
                      >
                        {busy === `remove-${s.name}` ? "…" : "移除"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {mode !== "idle" && (
        <McpModal
          mode={mode}
          server={editing}
          onClose={closeModal}
          onSaved={async () => {
            closeModal();
            await refresh();
          }}
        />
      )}

      {toolsFor && (
        <McpToolsModal
          serverName={toolsFor}
          onClose={() => setToolsFor(null)}
        />
      )}
    </div>
  );
};
