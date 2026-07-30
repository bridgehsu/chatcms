import { useEffect, useState, type MouseEvent } from "react";
import { invoke } from "@/hooks/useTauri";
import { usePermissionStore } from "@/stores/usePermissionStore";
import type { DomainPolicy, PermissionMode } from "@/types";
import { PermissionModeModal } from "./PermissionModeModal";

const POLICY_SHORT: Record<DomainPolicy, string> = {
  allow: "允",
  ask: "询",
  deny: "拒",
};

const SUMMARY_KEYS = [
  "file_read",
  "file_write",
  "shell",
  "mcp",
  "agent",
] as const;

const SUMMARY_LABEL: Record<string, string> = {
  file_read: "读",
  file_write: "写",
  shell: "终端",
  mcp: "MCP",
  agent: "代理",
};

const domainSummary = (domains: Record<string, DomainPolicy>) =>
  SUMMARY_KEYS.map((k) => {
    const p = domains[k] ?? "ask";
    return `${SUMMARY_LABEL[k]}${POLICY_SHORT[p]}`;
  }).join(" · ");

export const PermissionsPanel = () => {
  const reloadStore = usePermissionStore((s) => s.load);
  const [modes, setModes] = useState<PermissionMode[]>([]);
  const [activeId, setActiveId] = useState("");
  const [modal, setModal] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<PermissionMode | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const list = await invoke<PermissionMode[]>("plugin:permission|permission_mode_list");
    const cfg = await invoke<{ active_mode_id: string }>("plugin:permission|permission_get");
    setModes(list);
    setActiveId(cfg.active_mode_id || list[0]?.id || "");
    await reloadStore();
  };

  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
  }, []);

  const openAdd = () => {
    setEditing(null);
    setModal("add");
    setError("");
  };

  const openEdit = (m: PermissionMode) => {
    setEditing(m);
    setModal("edit");
    setError("");
  };

  const closeModal = () => {
    setModal("idle");
    setEditing(null);
  };

  const move = async (id: string, dir: -1 | 1, e: MouseEvent) => {
    e.stopPropagation();
    const idx = modes.findIndex((m) => m.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= modes.length) return;
    const ordered = modes.map((m) => m.id);
    [ordered[idx], ordered[next]] = [ordered[next], ordered[idx]];
    setBusy(`move-${id}`);
    setError("");
    try {
      const list = await invoke<PermissionMode[]>("plugin:permission|permission_mode_reorder", {
        orderedIds: ordered,
      });
      setModes(list);
      await reloadStore();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("确定删除该权限模式？")) return;
    setBusy(`remove-${id}`);
    setError("");
    try {
      await invoke("plugin:permission|permission_mode_remove", { id });
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const activate = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setBusy(`active-${id}`);
    try {
      await invoke("plugin:permission|permission_mode_set_active", { id });
      setActiveId(id);
      await reloadStore();
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
          <p className="permission-manage__lede">
            自定义权限模式并调整顺序；会话工具栏按此顺序展示，默认第一项。
          </p>
        </div>
        <button className="model-btn-add" type="button" onClick={openAdd}>
          + 新建模式
        </button>
      </div>

      {error ? <div className="mcp-form-error">{error}</div> : null}

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th className="model-table__idx">#</th>
              <th>名称</th>
              <th>域策略摘要</th>
              <th>排序</th>
              <th>状态</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {modes.map((m, i) => (
              <tr key={m.id} onClick={() => openEdit(m)}>
                <td className="model-table__idx">{i + 1}</td>
                <td>
                  <div className="permission-manage__name">{m.name}</div>
                  {m.description ? (
                    <div className="permission-manage__desc">{m.description}</div>
                  ) : null}
                </td>
                <td className="permission-manage__sum">
                  {domainSummary(m.domains)}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="permission-manage__sort">
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={i === 0 || busy !== null}
                      onClick={(e) => void move(m.id, -1, e)}
                      aria-label="上移"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={i === modes.length - 1 || busy !== null}
                      onClick={(e) => void move(m.id, 1, e)}
                      aria-label="下移"
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {activeId === m.id ? (
                    <span className="permission-manage__badge">使用中</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busy !== null}
                      onClick={(e) => void activate(m.id, e)}
                    >
                      设为当前
                    </button>
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn-mcp-remove"
                    disabled={busy !== null || modes.length <= 1}
                    onClick={(e) => void remove(m.id, e)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {modes.length === 0 ? (
              <tr>
                <td colSpan={6} className="model-table__empty">
                  暂无模式，请新建
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {modal !== "idle" ? (
        <PermissionModeModal
          mode={modal}
          editing={editing}
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
