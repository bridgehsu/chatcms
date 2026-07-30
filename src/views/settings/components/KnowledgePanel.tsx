import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { invoke } from "@/hooks/useTauri";
import type {
  KnowledgeEntry,
  KnowledgeExportResult,
  KnowledgeSiteProfile,
} from "@/types";
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

const DEFAULT_EXPORT =
  "/Users/xukui/demo-workspace/chatcms.org/content";

type VisFilter = "all" | "private" | "public";

export const KnowledgePanel = () => {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [profile, setProfile] = useState<KnowledgeSiteProfile>({
    handle: "me",
    display_name: "ChatCMS User",
    bio: "",
  });
  const [query, setQuery] = useState("");
  const [visFilter, setVisFilter] = useState<VisFilter>("all");
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [exportDir, setExportDir] = useState(DEFAULT_EXPORT);
  const [exportMsg, setExportMsg] = useState("");

  const refresh = async () => {
    const [list, site] = await Promise.all([
      invoke<KnowledgeEntry[]>("plugin:knowledge|knowledge_list"),
      invoke<KnowledgeSiteProfile>("plugin:knowledge|knowledge_site_profile_get"),
    ]);
    setEntries(list);
    setProfile(site);
  };

  useEffect(() => {
    void refresh().catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const vis = e.visibility === "public" ? "public" : "private";
      if (visFilter !== "all" && vis !== visFilter) return false;
      if (!q) return true;
      return [e.title, e.description, e.content, e.tags.join(" "), e.slug ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [entries, query, visFilter]);

  const publicCount = useMemo(
    () => entries.filter((e) => e.visibility === "public").length,
    [entries],
  );

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
    if (!window.confirm("确定删除该知识条目？")) return;
    setBusy(`remove-${id}`);
    setError("");
    try {
      await invoke("plugin:knowledge|knowledge_remove", { id });
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = async () => {
    setBusy("profile");
    setError("");
    setExportMsg("");
    try {
      const next = await invoke<KnowledgeSiteProfile>(
        "knowledge_site_profile_set",
        {
          handle: profile.handle,
          displayName: profile.display_name,
          bio: profile.bio,
        },
      );
      setProfile(next);
      setExportMsg("公开主页资料已保存");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const exportPublic = async () => {
    setBusy("export");
    setError("");
    setExportMsg("");
    try {
      const result = await invoke<KnowledgeExportResult>(
        "knowledge_export_public",
        { outputDir: exportDir.trim() },
      );
      setExportMsg(
        `已导出 ${result.count} 条到 ${result.output_dir}（feed: ${result.feed_path}）`,
      );
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
              aria-label="搜索知识库"
            />
          </div>
          <select
            value={visFilter}
            onChange={(e) => setVisFilter(e.target.value as VisFilter)}
            aria-label="可见性筛选"
          >
            <option value="all">全部</option>
            <option value="private">仅私有</option>
            <option value="public">仅公开</option>
          </select>
        </div>
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 新建知识
        </button>
      </div>

      <div className="mcp-form-row" style={{ marginBottom: 12 }}>
        <label>公开主页（chatcms.org/u/…）</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            style={{ flex: "0 1 140px" }}
            value={profile.handle}
            onChange={(e) =>
              setProfile({ ...profile, handle: e.target.value })
            }
            placeholder="handle"
          />
          <input
            style={{ flex: "1 1 160px" }}
            value={profile.display_name}
            onChange={(e) =>
              setProfile({ ...profile, display_name: e.target.value })
            }
            placeholder="显示名"
          />
          <input
            style={{ flex: "1 1 200px" }}
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            placeholder="一句话简介"
          />
          <button
            type="button"
            className="btn-ghost"
            disabled={busy === "profile"}
            onClick={() => void saveProfile()}
          >
            {busy === "profile" ? "…" : "保存资料"}
          </button>
        </div>
      </div>

      <div className="mcp-form-row" style={{ marginBottom: 12 }}>
        <label>
          导出公开快照到站点 content（当前公开 {publicCount} 条）
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            style={{ flex: "1 1 280px" }}
            value={exportDir}
            onChange={(e) => setExportDir(e.target.value)}
            placeholder={DEFAULT_EXPORT}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={busy === "export" || publicCount === 0}
            onClick={() => void exportPublic()}
          >
            {busy === "export" ? "导出中…" : "发布到站点"}
          </button>
        </div>
        {exportMsg ? (
          <p className="skill-modal__hint" style={{ marginTop: 6 }}>
            {exportMsg}
          </p>
        ) : null}
      </div>

      {error ? <div className="mcp-form-error">{error}</div> : null}

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th className="model-table__idx">#</th>
              <th>标题</th>
              <th>可见</th>
              <th>类型</th>
              <th>描述</th>
              <th>标签</th>
              <th>创建</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="model-table__empty">
                  {entries.length === 0
                    ? "暂无知识条目；私有条目注入对话，公开条目可导出到 chatcms.org"
                    : "没有匹配的条目"}
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
                    {e.slug ? (
                      <div className="skill-table__desc">/{e.slug}</div>
                    ) : null}
                  </td>
                  <td>
                    {e.visibility === "public" ? (
                      <span className="knowledge-tag">公开</span>
                    ) : (
                      <span className="model-status-idle">私有</span>
                    )}
                  </td>
                  <td className="model-table__mono">{e.kind || "note"}</td>
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
