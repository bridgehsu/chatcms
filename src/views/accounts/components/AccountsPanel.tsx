import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/Select";
import {
  PLATFORM_OPTIONS,
  platformLabel,
  type PlatformId,
} from "@/config/platformPresets";
import { invoke } from "@/hooks/useTauri";
import type { PlatformAccount } from "@/types";
import { AccountModal } from "./AccountModal";

const ALL = "all" as const;

const maskKey = (key: string) => {
  if (!key) return "未设置";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
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

export const AccountsPanel = () => {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [platformFilter, setPlatformFilter] = useState<PlatformId | typeof ALL>(ALL);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<PlatformAccount | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const list = await invoke<PlatformAccount[]>("account_list");
    setAccounts(list);
  };

  useEffect(() => {
    void refresh().catch(console.error);
  }, []);

  const platformOptions = useMemo(
    () => [{ value: ALL, label: "全部平台" }, ...PLATFORM_OPTIONS],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (platformFilter !== ALL && a.platform !== platformFilter) return false;
      if (!q) return true;
      const hay = [
        a.name,
        a.platform,
        platformLabel(a.platform),
        a.account_id,
        a.notes,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [accounts, platformFilter, query]);

  const openAdd = () => {
    setError("");
    setEditing(null);
    setMode("add");
  };

  const openEdit = (a: PlatformAccount) => {
    setError("");
    setEditing(a);
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
      await invoke("account_remove", { id });
      if (editing?.id === id) closeModal();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleEnabled = async (a: PlatformAccount) => {
    setBusy(`toggle-${a.id}`);
    setError("");
    try {
      await invoke("account_update", {
        id: a.id,
        name: a.name,
        platform: a.platform,
        accountId: a.account_id,
        accessKey: a.access_key,
        secretKey: a.secret_key,
        enabled: !a.enabled,
        notes: a.notes,
      });
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="model-panel">
      <header className="model-panel__header">
        <div>
          <h1 className="model-panel__title">账号管理</h1>
          <p className="model-panel__desc">
            管理各大内容平台的账号与密钥，数据保存在本机应用目录
          </p>
        </div>
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 添加账号
        </button>
      </header>

      <div className="model-toolbar">
        <div className="model-filters">
          <div className="model-filter model-filter--family">
            <Select
              aria-label="筛选平台"
              value={platformFilter}
              options={platformOptions}
              onChange={setPlatformFilter}
            />
          </div>
          <div className="model-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索名称、账号、备注…"
              aria-label="搜索账号"
            />
          </div>
        </div>
      </div>

      {error && <div className="mcp-form-error">{error}</div>}

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>平台</th>
              <th>账号标识</th>
              <th>主密钥</th>
              <th>状态</th>
              <th>更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="model-table__empty">
                  {accounts.length === 0
                    ? "尚未添加平台账号"
                    : "没有匹配的账号"}
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr
                  key={a.id}
                  className="model-table__row"
                  onClick={() => openEdit(a)}
                >
                  <td>
                    <span className="model-table__name">{a.name}</span>
                    {a.notes ? (
                      <div className="account-table__notes">{a.notes}</div>
                    ) : null}
                  </td>
                  <td>{platformLabel(a.platform)}</td>
                  <td className="model-table__mono model-table__url">
                    {a.account_id || "—"}
                  </td>
                  <td className="model-table__mono">{maskKey(a.access_key)}</td>
                  <td>
                    {a.enabled ? (
                      <span className="model-badge">启用</span>
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
                      <button
                        className="btn-mcp-action"
                        onClick={() => void toggleEnabled(a)}
                        disabled={busy === `toggle-${a.id}`}
                        type="button"
                      >
                        {busy === `toggle-${a.id}`
                          ? "…"
                          : a.enabled
                            ? "停用"
                            : "启用"}
                      </button>
                      <button
                        className="btn-mcp-action"
                        onClick={() => openEdit(a)}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        className="btn-mcp-remove"
                        onClick={() => void remove(a.id)}
                        disabled={busy === `remove-${a.id}`}
                        type="button"
                      >
                        {busy === `remove-${a.id}` ? "…" : "移除"}
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
        <AccountModal
          mode={mode}
          account={editing}
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
