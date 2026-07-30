import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Select } from "@/components/Select";
import { invoke } from "@/hooks/useTauri";
import type {
  MediaPlatform,
  MediaPlatformPage,
  MediaPlatformPageItem,
} from "@/types";
import { MediaPlatformModal } from "./MediaPlatformModal";

const ALL = "all" as const;
const PAGE_SIZE = 10;

const KIND_LABEL: Record<string, string> = {
  dynamic: "动态",
  article: "文章",
  video: "视频",
};

const kindLabel = (kind: string) => KIND_LABEL[kind] ?? kind;

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

const toPlatform = (row: MediaPlatformPageItem): MediaPlatform => ({
  id: row.id,
  code: row.code,
  name: row.name,
  kind: row.kind,
  inject_url: row.inject_url,
  home_url: row.home_url,
  enabled: row.enabled,
  notes: row.notes,
  updated_at: row.updated_at,
});

export const MediaPlatformsPanel = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<MediaPlatformPageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kindFilter, setKindFilter] = useState<string | typeof ALL>(ALL);
  const [query, setQuery] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<MediaPlatform | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const indexBase = (safePage - 1) * PAGE_SIZE;

  const refresh = useCallback(
    async (pageNum: number) => {
      const result = await invoke<MediaPlatformPage>("media_platform_list_page", {
        query: query.trim() || null,
        kind: kindFilter === ALL ? null : kindFilter,
        page: pageNum,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
      setPage(result.page);
    },
    [query, kindFilter],
  );

  useEffect(() => {
    void refresh(1).catch((e) => setError(String(e)));
  }, [refresh]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(queryInput);
    }, 250);
    return () => window.clearTimeout(t);
  }, [queryInput]);

  const kindOptions = useMemo(
    () => [
      { value: ALL, label: "全部类型" },
      { value: "dynamic", label: "动态" },
      { value: "article", label: "文章" },
      { value: "video", label: "视频" },
    ],
    [],
  );

  const openAdd = () => {
    setError("");
    setEditing(null);
    setMode("add");
  };

  const openEdit = (p: MediaPlatformPageItem) => {
    setError("");
    setEditing(toPlatform(p));
    setMode("edit");
  };

  const closeModal = () => {
    setMode("idle");
    setEditing(null);
    setError("");
  };

  const remove = async (id: string) => {
    if (!window.confirm("确定删除该平台？关联脚本也会一并删除。")) return;
    setBusy(`remove-${id}`);
    setError("");
    try {
      await invoke("media_platform_remove", { id });
      if (editing?.id === id) closeModal();
      await refresh(safePage);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleEnabled = async (p: MediaPlatformPageItem) => {
    setBusy(`toggle-${p.id}`);
    setError("");
    try {
      await invoke("media_platform_set_enabled", {
        id: p.id,
        enabled: !p.enabled,
      });
      await refresh(safePage);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const scriptStatus = (row: MediaPlatformPageItem) => {
    if (!row.script_is_published) {
      return <span className="model-status-idle">未发布</span>;
    }
    if (row.script_has_unpublished_draft) {
      return (
        <span className="model-badge">
          有草稿 · v{row.script_published_version}
        </span>
      );
    }
    return (
      <span className="model-badge">已发布 · v{row.script_published_version}</span>
    );
  };

  const collectScriptStatus = (row: MediaPlatformPageItem) => {
    if (!row.collect_script_is_published) {
      return <span className="model-status-idle">未发布</span>;
    }
    if (row.collect_script_has_unpublished_draft) {
      return (
        <span className="model-badge">
          有草稿 · v{row.collect_script_published_version}
        </span>
      );
    }
    return (
      <span className="model-badge">
        已发布 · v{row.collect_script_published_version}
      </span>
    );
  };

  const goPage = (next: number) => {
    void refresh(next).catch((e) => setError(String(e)));
  };

  return (
    <div className="model-panel">
      <div className="model-toolbar">
        <div className="model-filters">
          <div className="model-filter model-filter--family">
            <Select
              aria-label="筛选类型"
              value={kindFilter}
              options={kindOptions}
              onChange={(v) => {
                setKindFilter(v);
              }}
            />
          </div>
          <div className="model-search">
            <input
              type="search"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="搜索名称、编码、URL…"
              aria-label="搜索平台"
            />
          </div>
        </div>
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 添加平台
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
                <th>编码</th>
                <th>类型</th>
                <th>注入页</th>
                <th>发布脚本</th>
                <th>采集脚本</th>
                <th>状态</th>
                <th>更新</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="model-table__empty">
                    {total === 0 && !query.trim() && kindFilter === ALL
                      ? "尚未配置发布平台"
                      : "没有匹配的平台"}
                  </td>
                </tr>
              ) : (
                items.map((p, i) => (
                  <tr
                    key={p.id}
                    className="model-table__row"
                    onClick={() => openEdit(p)}
                  >
                    <td className="model-table__idx model-table__mono">
                      {indexBase + i + 1}
                    </td>
                    <td>
                      <span className="model-table__name">{p.name}</span>
                      {p.notes ? (
                        <div className="account-table__notes">{p.notes}</div>
                      ) : null}
                    </td>
                    <td className="model-table__mono">{p.code}</td>
                    <td>{kindLabel(p.kind)}</td>
                    <td className="model-table__mono model-table__url">
                      {p.inject_url || "—"}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {scriptStatus(p)}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {collectScriptStatus(p)}
                    </td>
                    <td>
                      {p.enabled ? (
                        <span className="model-badge">启用</span>
                      ) : (
                        <span className="model-status-idle">停用</span>
                      )}
                    </td>
                    <td className="model-table__mono">
                      {formatTime(p.updated_at)}
                    </td>
                    <td>
                      <div
                        className="model-table__actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="btn-mcp-action"
                          onClick={() =>
                            navigate(`/media-platforms/${p.id}/script`)
                          }
                          type="button"
                        >
                          发布脚本
                        </button>
                        <button
                          className="btn-mcp-action"
                          onClick={() =>
                            navigate(`/media-platforms/${p.id}/collect-script`)
                          }
                          type="button"
                        >
                          采集脚本
                        </button>
                        <button
                          className="btn-mcp-action"
                          onClick={() => void toggleEnabled(p)}
                          disabled={busy === `toggle-${p.id}`}
                          type="button"
                        >
                          {busy === `toggle-${p.id}`
                            ? "…"
                            : p.enabled
                              ? "停用"
                              : "启用"}
                        </button>
                        <button
                          className="btn-mcp-action"
                          onClick={() => openEdit(p)}
                          type="button"
                        >
                          编辑
                        </button>
                        <button
                          className="btn-mcp-remove"
                          onClick={() => void remove(p.id)}
                          disabled={busy === `remove-${p.id}`}
                          type="button"
                        >
                          {busy === `remove-${p.id}` ? "…" : "移除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="media-lib__pager">
          <span className="media-lib__pager-info">
            共 {total} 项
            {total > 0 ? ` · 第 ${safePage}/${totalPages} 页` : ""}
          </span>
          <div className="media-lib__pager-btns">
            <button
              type="button"
              className="btn-mcp-action"
              disabled={safePage <= 1}
              onClick={() => goPage(safePage - 1)}
            >
              上一页
            </button>
            <button
              type="button"
              className="btn-mcp-action"
              disabled={safePage >= totalPages}
              onClick={() => goPage(safePage + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      </section>

      {mode !== "idle" && (
        <MediaPlatformModal
          mode={mode}
          platform={editing}
          onClose={closeModal}
          onSaved={async () => {
            closeModal();
            await refresh(mode === "add" ? 1 : safePage);
          }}
        />
      )}
    </div>
  );
};
