import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { invoke } from "@/hooks/useTauri";
import type { KnowledgeEntry } from "@/types";
import { KnowledgeModal } from "./KnowledgeModal";

const formatTime = (ts: number) => {
  if (!ts) return "—";
  try {
    const ms = ts < 1e12 ? ts * 1000 : ts;
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

export const KnowledgePanel = () => {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const list = await invoke<KnowledgeEntry[]>("knowledge_list");
    setEntries(list);
  };

  useEffect(() => {
    void refresh().catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.title, e.description, e.content, e.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [entries, query]);

  const openAdd = () => {
    setError("");
    setEditing(null);
    setMode("add");
  };

  const openEdit = (e: KnowledgeEntry) => {
    setError("");
    setEditing(e);
    setMode("edit");
  };

  const closeModal = () => {
    setMode("idle");
    setEditing(null);
    setError("");
  };

  const remove = async (id: string, ev: MouseEvent) => {
    ev.stopPropagation();
    if (!window.confirm("确定删除该记忆条目？")) return;
    setBusy(`remove-${id}`);
    setError("");
    try {
      await invoke("knowledge_remove", { id });
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
              placeholder="搜索标题、描述、内容、标签…"
              aria-label="搜索记忆"
            />
          </div>
        </div>
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 新建记忆
        </button>
      </div>

      {error ? <div className="mcp-form-error">{error}</div> : null}

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th className="model-table__idx">#</th>
              <th>标题</th>
              <th>描述</th>
              <th>标签</th>
              <th>创建</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="model-table__empty">
                  {entries.length === 0
                    ? "暂无记忆条目，相关内容会注入对话提示词"
                    : "没有匹配的记忆"}
                </td>
              </tr>
            ) : (
              filtered.map((e, index) => (
                <tr
                  key={e.id}
                  className="model-table__row"
                  onClick={() => openEdit(e)}
                >
                  <td className="model-table__idx model-table__mono">
                    {index + 1}
                  </td>
                  <td>
                    <span className="model-table__name">{e.title}</span>
                  </td>
                  <td>
                    <div className="skill-table__desc">
                      {e.description || "—"}
                    </div>
                  </td>
                  <td>
                    {e.tags.length > 0 ? (
                      <div className="knowledge-table__tags">
                        {e.tags.map((t) => (
                          <span key={t} className="knowledge-tag">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="model-status-idle">—</span>
                    )}
                  </td>
                  <td className="model-table__mono">
                    {formatTime(e.created_at)}
                  </td>
                  <td>
                    <div
                      className="model-table__actions"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <button
                        className="btn-mcp-action"
                        onClick={() => openEdit(e)}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        className="btn-mcp-remove"
                        onClick={(ev) => void remove(e.id, ev)}
                        disabled={busy === `remove-${e.id}`}
                        type="button"
                      >
                        {busy === `remove-${e.id}` ? "…" : "删除"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {mode !== "idle" ? (
        <KnowledgeModal
          mode={mode}
          entry={editing}
          onClose={closeModal}
          onSaved={async () => {
            closeModal();
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
};
