import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/Select";
import {
  FAMILY_OPTIONS,
  getVersionOptions,
  matchFamilyVersion,
  type FamilyId,
} from "@/config/modelPresets";
import { invoke } from "@/hooks/useTauri";
import { useProviderStore } from "@/stores/useProviderStore";
import type { ProviderKind, ProviderProfile } from "@/types";
import { ModelConfigModal } from "./ModelConfigModal";

const ALL = "all" as const;

const maskKey = (key: string) => {
  if (!key) return "未设置";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
};

const kindLabel = (kind: ProviderKind) =>
  kind === "anthropic" ? "Anthropic" : "OpenAI 兼容";

export const ModelConfigPanel = () => {
  const loadActive = useProviderStore((s) => s.load);
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [familyFilter, setFamilyFilter] = useState<FamilyId | typeof ALL>(ALL);
  const [versionFilter, setVersionFilter] = useState<string>(ALL);
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<ProviderProfile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const list = await invoke<ProviderProfile[]>("provider_list");
    setProfiles(list);
  };

  useEffect(() => {
    void refresh().catch(console.error);
  }, []);

  const familyOptions = useMemo(
    () => [{ value: ALL, label: "全部模型" }, ...FAMILY_OPTIONS],
    [],
  );

  const versionOptions = useMemo(() => {
    if (familyFilter === ALL) {
      return [{ value: ALL, label: "全部版本" }];
    }
    return [
      { value: ALL, label: "全部版本" },
      ...getVersionOptions(familyFilter),
    ];
  }, [familyFilter]);

  const filtered = useMemo(() => {
    if (familyFilter === ALL) return profiles;
    return profiles.filter((p) => {
      const matched = matchFamilyVersion(p.kind, p.model, p.base_url ?? "");
      if (matched.familyId !== familyFilter) return false;
      if (versionFilter === ALL) return true;
      return matched.versionId === versionFilter || p.model === versionFilter;
    });
  }, [profiles, familyFilter, versionFilter]);

  const onFamilyChange = (id: FamilyId | typeof ALL) => {
    setFamilyFilter(id);
    setVersionFilter(ALL);
  };

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
      await invoke("provider_remove", { id });
      if (editing?.id === id) closeModal();
      await refresh();
      await loadActive();
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
          <div className="model-filter model-filter--family">
            <Select
              aria-label="筛选模型"
              value={familyFilter}
              options={familyOptions}
              onChange={onFamilyChange}
            />
          </div>
          <div className="model-filter model-filter--version">
            <Select
              aria-label="筛选版本"
              value={versionFilter}
              options={versionOptions}
              onChange={setVersionFilter}
            />
          </div>
        </div>
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 添加配置
        </button>
      </div>

      {error && <div className="mcp-form-error">{error}</div>}

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th className="model-table__idx">#</th>
              <th>名称</th>
              <th>协议</th>
              <th>模型</th>
              <th>API 密钥</th>
              <th>接口地址</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="model-table__empty">
                  {profiles.length === 0 ? "尚未添加模型配置" : "没有匹配的配置"}
                </td>
              </tr>
            ) : (
              filtered.map((p, index) => (
                <tr
                  key={p.id}
                  className="model-table__row"
                  onClick={() => openEdit(p)}
                >
                  <td className="model-table__idx model-table__mono">
                    {index + 1}
                  </td>
                  <td>
                    <span className="model-table__name">{p.name}</span>
                  </td>
                  <td>{kindLabel(p.kind)}</td>
                  <td className="model-table__mono">{p.model}</td>
                  <td className="model-table__mono">{maskKey(p.api_key)}</td>
                  <td className="model-table__mono model-table__url">
                    {p.base_url || "—"}
                  </td>
                  <td>
                    <span className="model-badge">启用</span>
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
                        disabled={busy === `remove-${p.id}` || profiles.length <= 1}
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

      {mode !== "idle" && (
        <ModelConfigModal
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
