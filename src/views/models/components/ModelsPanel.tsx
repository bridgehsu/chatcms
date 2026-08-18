import { useEffect, useMemo, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import { useProviderStore } from "@/stores/useProviderStore";
import type { ProviderKind } from "@/types";
import { ModelModal } from "./ModelModal";

/** 新版 ProviderProfile（含 tier / weight / context_window） */
export interface ProviderProfile {
  id: string;
  name: string;
  kind: ProviderKind;
  api_key: string;
  model: string;
  base_url?: string | null;
  tier: "local" | "cloud";
  weight: number;
  context_window: number;
  enabled: boolean;
  created: number;
  updated: number;
}

const kindLabel = (kind: ProviderKind) =>
  kind === "anthropic" ? "Anthropic" : "OpenAI 兼容";

const tierLabel = (tier: "local" | "cloud") =>
  tier === "local" ? "本地" : "云端";

export const ModelsPanel = () => {
  const loadActive = useProviderStore((s) => s.load);
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<ProviderProfile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const list = await invoke<ProviderProfile[]>("model_profile_list");
    setProfiles(list);
  };

  useEffect(() => {
    void refresh().catch(console.error);
  }, []);

  /** 按 tier 分组，组内按 weight 降序 */
  const grouped = useMemo(() => {
    const sorted = [...profiles].sort((a, b) => b.weight - a.weight);
    const local = sorted.filter((p) => p.tier === "local");
    const cloud = sorted.filter((p) => p.tier === "cloud");
    return { local, cloud };
  }, [profiles]);

  const openAdd = () => {
    setError("");
    setEditing(null);
    setMode("add");
  };

  const openEdit = (p: ProviderProfile) => {
    setError("");
    setEditing(p);
    setMode("edit");
  };

  const closeModal = () => {
    setMode("idle");
    setEditing(null);
    setError("");
  };

  const remove = async (id: string) => {
    setBusy(`remove-${id}`);
    setError("");
    try {
      await invoke("model_profile_remove", { id });
      if (editing?.id === id) closeModal();
      await refresh();
      await loadActive();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const renderGroup = (
    label: string,
    items: ProviderProfile[],
    startIndex: number,
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="model-group" key={label}>
        <div className="model-group__header">{label}</div>
        <table className="model-table">
          <thead>
            <tr>
              <th className="model-table__idx">#</th>
              <th>名称</th>
              <th>协议</th>
              <th>模型 ID</th>
              <th>权重</th>
              <th>Context 窗口</th>
              <th>接口地址</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, index) => (
              <tr
                key={p.id}
                className="model-table__row"
                onClick={() => openEdit(p)}
              >
                <td className="model-table__idx model-table__mono">
                  {startIndex + index + 1}
                </td>
                <td>
                  <span className="model-table__name">{p.name}</span>
                </td>
                <td>{kindLabel(p.kind)}</td>
                <td className="model-table__mono">{p.model}</td>
                <td className="model-table__mono">{p.weight}</td>
                <td className="model-table__mono">
                  {p.context_window.toLocaleString()}
                </td>
                <td className="model-table__mono model-table__url">
                  {p.base_url || "—"}
                </td>
                <td>
                  <span
                    className={`model-badge${p.enabled ? "" : " model-badge--disabled"}`}
                  >
                    {p.enabled ? "启用" : "禁用"}
                  </span>
                </td>
                <td>
                  <div
                    className="model-table__actions"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                      disabled={
                        busy === `remove-${p.id}` || profiles.length <= 1
                      }
                      type="button"
                    >
                      {busy === `remove-${p.id}` ? "…" : "移除"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="model-panel">
      <div className="model-toolbar">
        <div className="model-filters" />
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 添加配置
        </button>
      </div>

      {error && <div className="mcp-form-error">{error}</div>}

      {profiles.length === 0 ? (
        <div className="model-table-wrap">
          <table className="model-table">
            <thead>
              <tr>
                <th className="model-table__idx">#</th>
                <th>名称</th>
                <th>协议</th>
                <th>模型 ID</th>
                <th>权重</th>
                <th>Context 窗口</th>
                <th>接口地址</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={9} className="model-table__empty">
                  尚未添加模型配置
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="model-table-wrap">
          {renderGroup(
            `云端模型（${tierLabel("cloud")}）`,
            grouped.cloud,
            0,
          )}
          {renderGroup(
            `本地模型（${tierLabel("local")}）`,
            grouped.local,
            grouped.cloud.length,
          )}
        </div>
      )}

      {mode !== "idle" && (
        <ModelModal
          mode={mode}
          profile={editing}
          onClose={closeModal}
          onSaved={async () => {
            closeModal();
            await refresh();
            await loadActive();
          }}
        />
      )}
    </div>
  );
};
