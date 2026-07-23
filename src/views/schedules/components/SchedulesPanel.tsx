import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@/hooks/useTauri";
import type { ScheduleProject } from "@/types";
import { ProjectModal } from "./ProjectModal";

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

export const SchedulesPanel = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ScheduleProject[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<ScheduleProject | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const list = await invoke<ScheduleProject[]>("schedule_list");
    setProjects(list);
  }, []);

  useEffect(() => {
    void refresh().catch(console.error);
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      [p.name, p.description].join(" ").toLowerCase().includes(q),
    );
  }, [projects, query]);

  const openAdd = () => {
    setError("");
    setEditing(null);
    setMode("add");
  };

  const openEdit = (p: ScheduleProject, e?: MouseEvent) => {
    e?.stopPropagation();
    setError("");
    setEditing(p);
    setMode("edit");
  };

  const closeModal = () => {
    setMode("idle");
    setEditing(null);
    setError("");
  };

  const remove = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setBusy(`remove-${id}`);
    setError("");
    try {
      await invoke("schedule_remove", { id });
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="model-panel">
      <header className="model-panel__header">
        <div>
          <h1 className="model-panel__title">任务调度</h1>
          <p className="model-panel__desc">
            创建调度项目，在画布中设计节点工作流（类似 n8n）
          </p>
        </div>
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 新建项目
        </button>
      </header>

      <div className="model-toolbar">
        <div className="model-filters">
          <div className="model-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索项目名称、描述…"
              aria-label="搜索项目"
            />
          </div>
        </div>
      </div>

      {error && <div className="mcp-form-error">{error}</div>}

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>节点</th>
              <th>连线</th>
              <th>状态</th>
              <th>更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="model-table__empty">
                  {projects.length === 0
                    ? "尚未创建调度项目，点击右上角新建"
                    : "没有匹配的项目"}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className="model-table__row"
                  onClick={() => navigate(`/schedules/${p.id}`)}
                >
                  <td>
                    <span className="model-table__name">{p.name}</span>
                    {p.description ? (
                      <div className="account-table__notes">{p.description}</div>
                    ) : null}
                  </td>
                  <td className="model-table__mono">
                    {p.workflow?.nodes?.length ?? 0}
                  </td>
                  <td className="model-table__mono">
                    {p.workflow?.edges?.length ?? 0}
                  </td>
                  <td>
                    {p.enabled ? (
                      <span className="model-badge">启用</span>
                    ) : (
                      <span className="model-status-idle">停用</span>
                    )}
                  </td>
                  <td className="model-table__mono">{formatTime(p.updated_at)}</td>
                  <td>
                    <div
                      className="model-table__actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="btn-mcp-action"
                        onClick={() => navigate(`/schedules/${p.id}`)}
                        type="button"
                      >
                        打开画布
                      </button>
                      <button
                        className="btn-mcp-action"
                        onClick={(e) => openEdit(p, e)}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        className="btn-mcp-remove"
                        onClick={(e) => void remove(p.id, e)}
                        disabled={busy === `remove-${p.id}`}
                        type="button"
                      >
                        {busy === `remove-${p.id}` ? "…" : "删除"}
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
        <ProjectModal
          mode={mode}
          project={editing}
          onClose={closeModal}
          onSaved={async (created) => {
            closeModal();
            await refresh();
            if (created) navigate(`/schedules/${created.id}`);
          }}
        />
      )}
    </div>
  );
};
