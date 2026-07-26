import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { invoke } from "@/hooks/useTauri";
import type { AgentProfile } from "@/types";
import { AgentModal } from "./AgentModal";

const formatTime = (ms: number) => {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const skillsLabel = (skills: string[] | null) => {
  if (skills === null) return "全部";
  if (skills.length === 0) return "无";
  return skills.join(", ");
};

export const AgentsPanel = () => {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<AgentProfile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const list = await invoke<AgentProfile[]>("agent_list");
    setAgents(list);
  };

  useEffect(() => {
    void refresh().catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
      [a.name, a.slug, a.description, a.system_prompt]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [agents, query]);

  const openAdd = () => {
    setError("");
    setEditing(null);
    setMode("add");
  };

  const openEdit = (a: AgentProfile) => {
    setError("");
    setEditing(a);
    setMode("edit");
  };

  const closeModal = () => {
    setMode("idle");
    setEditing(null);
    setError("");
  };

  const activate = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setBusy(`activate-${id}`);
    setError("");
    try {
      await invoke("agent_activate", { id });
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setBusy(`remove-${id}`);
    setError("");
    try {
      await invoke("agent_remove", { id });
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
          <div className="model-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索名称、ID、描述…"
              aria-label="搜索代理"
            />
          </div>
        </div>
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 新建代理
        </button>
      </div>

      {error && <div className="mcp-form-error">{error}</div>}

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th className="model-table__idx">#</th>
              <th>代理</th>
              <th>ID</th>
              <th>技能</th>
              <th>子代理</th>
              <th>状态</th>
              <th>更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="model-table__empty">
                  {agents.length === 0 ? "暂无代理" : "没有匹配的代理"}
                </td>
              </tr>
            ) : (
              filtered.map((a, index) => (
                <tr
                  key={a.id}
                  className="model-table__row"
                  onClick={() => openEdit(a)}
                >
                  <td className="model-table__idx model-table__mono">
                    {index + 1}
                  </td>
                  <td>
                    <span className="model-table__name">
                      {a.emoji ? `${a.emoji} ` : ""}
                      {a.name}
                    </span>
                    {a.description ? (
                      <div className="account-table__notes">{a.description}</div>
                    ) : null}
                  </td>
                  <td className="model-table__mono">{a.slug}</td>
                  <td>
                    <div className="skill-table__desc">{skillsLabel(a.skills)}</div>
                  </td>
                  <td>
                    {a.allow_as_subagent ? (
                      <span className="model-status-idle">允许</span>
                    ) : (
                      <span className="model-status-idle">禁止</span>
                    )}
                  </td>
                  <td>
                    {a.is_default ? (
                      <span className="model-badge">当前</span>
                    ) : a.enabled ? (
                      <span className="model-status-idle">启用</span>
                    ) : (
                      <span className="model-status-idle">停用</span>
                    )}
                  </td>
                  <td className="model-table__mono">{formatTime(a.updated_at)}</td>
                  <td>
                    <div
                      className="model-table__actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!a.is_default && (
                        <button
                          className="btn-mcp-action"
                          onClick={(e) => void activate(a.id, e)}
                          disabled={busy === `activate-${a.id}` || !a.enabled}
                          type="button"
                        >
                          {busy === `activate-${a.id}` ? "…" : "设为当前"}
                        </button>
                      )}
                      <button
                        className="btn-mcp-action"
                        onClick={() => openEdit(a)}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        className="btn-mcp-remove"
                        onClick={(e) => void remove(a.id, e)}
                        disabled={
                          busy === `remove-${a.id}` || agents.length <= 1
                        }
                        type="button"
                      >
                        {busy === `remove-${a.id}` ? "…" : "删除"}
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
        <AgentModal
          mode={mode}
          agent={editing}
          onClose={closeModal}
          onSaved={async () => {
            closeModal();
            await refresh();
          }}
        />
      )}
    </div>
  );
};
