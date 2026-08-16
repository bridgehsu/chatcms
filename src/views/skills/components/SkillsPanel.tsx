import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Select } from "@/components/Select";
import { invoke } from "@/hooks/useTauri";
import type { Skill, SkillSource } from "@/types";
import { SkillModal } from "./SkillModal";

const ALL = "all" as const;

const sourceLabel = (s: SkillSource) => {
  if (s === "bundled") return "内置";
  if (s === "managed") return "托管";
  return "工作区";
};

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

export const SkillsPanel = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SkillSource | typeof ALL>(ALL);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<Skill | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // npx install
  const [npxOpen, setNpxOpen] = useState(false);
  const [npxPkg, setNpxPkg] = useState("");
  const [npxBusy, setNpxBusy] = useState(false);
  const [npxResult, setNpxResult] = useState<string | null>(null);
  const npxInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const list = await invoke<Skill[]>("skill_list");
    setSkills(list);
  };

  useEffect(() => {
    void refresh().catch(console.error);
  }, []);

  const sourceOptions = useMemo(
    () => [
      { value: ALL, label: "全部来源" },
      { value: "bundled" as const, label: "内置" },
      { value: "workspace" as const, label: "工作区" },
      { value: "managed" as const, label: "托管" },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (sourceFilter !== ALL && s.source !== sourceFilter) return false;
      if (!q) return true;
      return [s.name, s.description, s.body]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [skills, sourceFilter, query]);

  const openAdd = () => {
    setError("");
    setEditing(null);
    setMode("add");
  };

  const openEdit = (s: Skill) => {
    setError("");
    setEditing(s);
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
      await invoke("skill_remove", { id });
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleEnabled = async (s: Skill, e: MouseEvent) => {
    e.stopPropagation();
    setBusy(`toggle-${s.id}`);
    setError("");
    try {
      await invoke("skill_update", {
        id: s.id,
        name: s.name,
        description: s.description,
        body: s.body,
        enabled: !s.enabled,
        userInvocable: s.user_invocable,
        disableModelInvocation: s.disable_model_invocation,
        homepage: s.homepage,
        metadata: s.metadata,
      });
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const copyMd = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setBusy(`copy-${id}`);
    setError("");
    try {
      const md = await invoke<string>("skill_export_md", { id });
      await navigator.clipboard.writeText(md);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const openNpx = () => {
    setNpxOpen(true);
    setNpxPkg("");
    setNpxResult(null);
    setError("");
    window.setTimeout(() => npxInputRef.current?.focus(), 50);
  };

  const closeNpx = () => {
    setNpxOpen(false);
    setNpxPkg("");
    setNpxResult(null);
  };

  const installNpx = async () => {
    const pkg = npxPkg.trim();
    if (!pkg) return;
    setNpxBusy(true);
    setNpxResult(null);
    setError("");
    try {
      const installed = await invoke<Skill[]>("skill_install_npx", { pkgName: pkg });
      await refresh();
      setNpxResult(
        installed.length > 0
          ? `已安装 ${installed.length} 个技能：${installed.map((s) => s.name).join("、")}`
          : "未发现新技能（包可能已安装）",
      );
      setNpxPkg("");
    } catch (err) {
      setError(String(err));
    } finally {
      setNpxBusy(false);
    }
  };

  return (
    <div className="model-panel">
      <div className="model-toolbar">
        <div className="model-filters">
          <div className="model-filter model-filter--family">
            <Select
              aria-label="筛选来源"
              value={sourceFilter}
              options={sourceOptions}
              onChange={setSourceFilter}
            />
          </div>
          <div className="model-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索名称、描述、正文…"
              aria-label="搜索技能"
            />
          </div>
        </div>
        <div className="model-btn-group">
          <button className="model-btn-add" onClick={openNpx} type="button">
            安装 NPX
          </button>
          <button className="model-btn-add" onClick={openAdd} type="button">
            + 新建技能
          </button>
        </div>
      </div>

      {npxOpen && (
        <div className="skill-npx-panel">
          <div className="skill-npx-title">从 npm 安装技能包</div>
          <div className="skill-npx-row">
            <span className="skill-npx-prefix">npx --yes</span>
            <input
              ref={npxInputRef}
              className="skill-npx-input"
              type="text"
              value={npxPkg}
              onChange={(e) => setNpxPkg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void installNpx();
                if (e.key === "Escape") closeNpx();
              }}
              placeholder="@chatcms/skill-xxx 或 chatcms-skill-xxx"
              disabled={npxBusy}
            />
            <button
              type="button"
              className="btn-primary skill-npx-btn"
              onClick={() => void installNpx()}
              disabled={!npxPkg.trim() || npxBusy}
            >
              {npxBusy ? "安装中…" : "安装"}
            </button>
            <button
              type="button"
              className="btn-ghost skill-npx-btn"
              onClick={closeNpx}
              disabled={npxBusy}
            >
              取消
            </button>
          </div>
          {npxResult && <div className="skill-npx-result">{npxResult}</div>}
          {error && <div className="mcp-form-error">{error}</div>}
        </div>
      )}

      {!npxOpen && error && <div className="mcp-form-error">{error}</div>}

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th className="model-table__idx">#</th>
              <th>名称</th>
              <th>描述</th>
              <th>来源</th>
              <th>状态</th>
              <th>更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="model-table__empty">
                  {skills.length === 0
                    ? "暂无技能"
                    : "没有匹配的技能"}
                </td>
              </tr>
            ) : (
              filtered.map((s, index) => (
                <tr
                  key={s.id}
                  className="model-table__row"
                  onClick={() => openEdit(s)}
                >
                  <td className="model-table__idx model-table__mono">
                    {index + 1}
                  </td>
                  <td>
                    <span className="model-table__name model-table__mono">
                      {s.name}
                    </span>
                    {s.disable_model_invocation ? (
                      <div className="account-table__notes">不注入提示词</div>
                    ) : null}
                  </td>
                  <td>
                    <div className="skill-table__desc">{s.description}</div>
                  </td>
                  <td>
                    <span className={`skill-source skill-source--${s.source}`}>
                      {sourceLabel(s.source)}
                    </span>
                  </td>
                  <td>
                    {s.enabled ? (
                      <span className="model-badge">启用</span>
                    ) : (
                      <span className="model-status-idle">停用</span>
                    )}
                  </td>
                  <td className="model-table__mono">{formatTime(s.updated)}</td>
                  <td>
                    <div
                      className="model-table__actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="btn-mcp-action"
                        onClick={(e) => void toggleEnabled(s, e)}
                        disabled={busy === `toggle-${s.id}`}
                        type="button"
                      >
                        {busy === `toggle-${s.id}`
                          ? "…"
                          : s.enabled
                            ? "停用"
                            : "启用"}
                      </button>
                      <button
                        className="btn-mcp-action"
                        onClick={() => openEdit(s)}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        className="btn-mcp-action"
                        onClick={(e) => void copyMd(s.id, e)}
                        disabled={busy === `copy-${s.id}`}
                        type="button"
                      >
                        {copiedId === s.id ? "已复制" : "SKILL.md"}
                      </button>
                      {s.source !== "bundled" && (
                        <button
                          className="btn-mcp-remove"
                          onClick={(e) => void remove(s.id, e)}
                          disabled={busy === `remove-${s.id}`}
                          type="button"
                        >
                          {busy === `remove-${s.id}` ? "…" : "删除"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {mode !== "idle" && (
        <SkillModal
          mode={mode}
          skill={editing}
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
