import { useEffect, useMemo, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { NavBookmark } from "@/types";
import { NavBookmarkModal } from "./NavBookmarkModal";

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

export const NavBookmarksPanel = () => {
  const [items, setItems] = useState<NavBookmark[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<NavBookmark | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const list = await invoke<NavBookmark[]>("nav_bookmark_list");
    setItems(list);
  };

  useEffect(() => {
    void refresh().catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((b) =>
      [b.title, b.url, b.note].join(" ").toLowerCase().includes(q),
    );
  }, [items, query]);

  const openAdd = () => {
    setError("");
    setEditing(null);
    setMode("add");
  };

  const openEdit = (b: NavBookmark) => {
    setError("");
    setEditing(b);
    setMode("edit");
  };

  const closeModal = () => {
    setMode("idle");
    setEditing(null);
    setError("");
  };

  const remove = async (id: string) => {
    if (!window.confirm("确定删除该导航？")) return;
    setBusy(`remove-${id}`);
    setError("");
    try {
      await invoke("nav_bookmark_remove", { id });
      if (editing?.id === id) closeModal();
      await refresh();
    } catch (e) {
      setError(String(e));
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
              placeholder="搜索名称、链接、备注…"
              aria-label="搜索导航"
            />
          </div>
        </div>
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 添加导航
        </button>
      </div>

      {error && <div className="mcp-form-error">{error}</div>}

      <section className="media-lib">
        <div className="model-table-wrap">
          <table className="model-table media-lib__table">
            <thead>
              <tr>
                <th className="model-table__idx">序号</th>
                <th>名称</th>
                <th>链接</th>
                <th>备注</th>
                <th>更新</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="model-table__empty">
                    {items.length === 0
                      ? "尚未添加导航，扩展侧栏「导航」与此处同源"
                      : "没有匹配的导航"}
                  </td>
                </tr>
              ) : (
                filtered.map((b, i) => (
                  <tr
                    key={b.id}
                    className="model-table__row"
                    onClick={() => openEdit(b)}
                  >
                    <td className="model-table__idx model-table__mono">
                      {i + 1}
                    </td>
                    <td>
                      <span className="model-table__name">{b.title}</span>
                    </td>
                    <td className="model-table__mono model-table__url">
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {b.url}
                      </a>
                    </td>
                    <td>{b.note?.trim() ? b.note : "—"}</td>
                    <td className="model-table__mono">
                      {formatTime(b.updated_at)}
                    </td>
                    <td>
                      <div
                        className="model-table__actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="btn-mcp-action"
                          type="button"
                          onClick={() => openEdit(b)}
                        >
                          编辑
                        </button>
                        <button
                          className="btn-mcp-remove"
                          type="button"
                          disabled={busy === `remove-${b.id}`}
                          onClick={() => void remove(b.id)}
                        >
                          {busy === `remove-${b.id}` ? "…" : "移除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {mode !== "idle" && (
        <NavBookmarkModal
          mode={mode}
          bookmark={editing}
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
