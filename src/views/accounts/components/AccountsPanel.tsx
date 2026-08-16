import { useCallback, useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Select } from "@/components/Select";
import { platformHomeUrl, platformLabel } from "@/config/platformPresets";
import { invoke } from "@/hooks/useTauri";
import type { PlatformAccount, VaultStatus } from "@/types";
import { AccountModal } from "./AccountModal";
import { EmptyAccountsArt } from "./EmptyAccountsArt";
import { RevealSecretsModal } from "./RevealSecretsModal";
import { VaultPasswordModal } from "./VaultPasswordModal";

const ALL = "all" as const;

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

const maskHint = (has: boolean | undefined, encrypted?: boolean) => {
  if (!has) return "未设置";
  return encrypted ? "••••••••（已加密）" : "••••••••";
};

export const AccountsPanel = () => {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [vault, setVault] = useState<VaultStatus>({
    configured: false,
    unlocked: false,
  });
  const [platformFilter, setPlatformFilter] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<PlatformAccount | null>(null);
  const [revealFor, setRevealFor] = useState<PlatformAccount | null>(null);
  const [vaultModal, setVaultModal] = useState<"unlock" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refreshVault = useCallback(async () => {
    const s = await invoke<VaultStatus>("vault_status");
    setVault(s);
  }, []);

  const refresh = useCallback(async () => {
    const list = await invoke<PlatformAccount[]>("account_list");
    setAccounts(list);
    await refreshVault();
  }, [refreshVault]);

  useEffect(() => {
    void refresh().catch(console.error);
  }, [refresh]);

  /** 筛选项仅来自本表已有平台，与媒体管理无关 */
  const platformOptions = useMemo(() => {
    const seen = new Set<string>();
    const fromTable: { value: string; label: string }[] = [];
    for (const a of accounts) {
      const p = a.platform.trim();
      if (!p || seen.has(p)) continue;
      seen.add(p);
      fromTable.push({ value: p, label: p });
    }
    fromTable.sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
    return [{ value: ALL, label: "全部平台" }, ...fromTable];
  }, [accounts]);

  useEffect(() => {
    if (
      platformFilter !== ALL &&
      !accounts.some((a) => a.platform === platformFilter)
    ) {
      setPlatformFilter(ALL);
    }
  }, [accounts, platformFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (platformFilter !== ALL && a.platform !== platformFilter) return false;
      if (!q) return true;
      const hay = [a.name, a.platform, a.phone, a.email, a.account_id, a.notes]
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

  const openHome = async (platform: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = platformHomeUrl(platform);
    if (!url) {
      setError("该平台未配置主页链接");
      return;
    }
    try {
      await openUrl(url);
    } catch (err) {
      setError(String(err));
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("确定删除该账号记录？")) return;
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
        phone: a.phone || "",
        email: a.email || "",
        accountId: a.account_id,
        accessKey: "",
        secretKey: "",
        enabled: !a.enabled,
        notes: a.notes,
        updateSecrets: false,
      });
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const lockVault = async () => {
    try {
      const s = await invoke<VaultStatus>("vault_lock");
      setVault(s);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="model-panel">
      {vault.configured ? (
        <div className="account-vault-bar">
          {vault.unlocked ? (
            <>
              <span className="account-vault-bar__text account-vault-bar__text--ok">
                保险柜已解锁（约 30 分钟内可查看敏感信息）
              </span>
              <button type="button" className="btn-ghost" onClick={() => void lockVault()}>
                锁定
              </button>
            </>
          ) : (
            <>
              <span className="account-vault-bar__text">
                保险柜已锁定，查看密码/私钥前请解锁
              </span>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setVaultModal("unlock")}
              >
                解锁
              </button>
            </>
          )}
        </div>
      ) : null}

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
              placeholder="搜索用户名、手机号、邮箱、公钥、备注…"
              aria-label="搜索账号"
            />
          </div>
        </div>
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 添加账号
        </button>
      </div>

      {error ? <div className="mcp-form-error">{error}</div> : null}

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th className="model-table__idx">#</th>
              <th>平台</th>
              <th>用户名</th>
              <th>手机号</th>
              <th>邮箱</th>
              <th>公钥</th>
              <th>密码</th>
              <th>私钥</th>
              <th>备注</th>
              <th>状态</th>
              <th>更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="model-table__empty">
                  <div className="account-empty">
                    {accounts.length === 0 ? (
                      <>
                        <EmptyAccountsArt />
                        <p className="account-empty__title">尚未添加平台账号</p>
                        <p className="account-empty__hint">
                          点击右上角「添加账号」开始录入
                        </p>
                      </>
                    ) : (
                      <>
                        <EmptyAccountsArt />
                        <p className="account-empty__title">没有匹配的账号</p>
                        <p className="account-empty__hint">
                          试试调整平台筛选或搜索关键词
                        </p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((a, index) => (
                <tr
                  key={a.id}
                  className="model-table__row"
                  onClick={() => openEdit(a)}
                >
                  <td className="model-table__idx model-table__mono">
                    {index + 1}
                  </td>
                  <td>
                    {platformHomeUrl(a.platform) ? (
                      <button
                        type="button"
                        className="account-platform-link"
                        title="打开平台主页"
                        onClick={(e) => void openHome(a.platform, e)}
                      >
                        {platformLabel(a.platform)} ↗
                      </button>
                    ) : (
                      <span>{platformLabel(a.platform) || "—"}</span>
                    )}
                  </td>
                  <td>
                    <span className="model-table__name">{a.name}</span>
                  </td>
                  <td className="model-table__mono">{a.phone || "—"}</td>
                  <td className="model-table__mono model-table__url">
                    {a.email || "—"}
                  </td>
                  <td className="model-table__mono model-table__url">
                    {a.account_id || "—"}
                  </td>
                  <td className="model-table__mono">
                    {maskHint(a.has_access_key, a.secrets_encrypted)}
                  </td>
                  <td className="model-table__mono">
                    {maskHint(a.has_secret_key, a.secrets_encrypted)}
                  </td>
                  <td>
                    <span className="account-table__notes">
                      {a.notes || "—"}
                    </span>
                  </td>
                  <td>
                    {a.enabled ? (
                      <span className="model-badge">启用</span>
                    ) : (
                      <span className="model-status-idle">停用</span>
                    )}
                  </td>
                  <td className="model-table__mono">{formatTime(a.updated)}</td>
                  <td>
                    <div
                      className="model-table__actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="btn-mcp-action"
                        type="button"
                        onClick={() => {
                          if (vault.configured && !vault.unlocked) {
                            setVaultModal("unlock");
                            setRevealFor(a);
                            return;
                          }
                          setRevealFor(a);
                        }}
                      >
                        查看
                      </button>
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
          vault={vault}
          onVaultChange={setVault}
          onClose={closeModal}
          onSaved={async () => {
            closeModal();
            await refresh();
          }}
        />
      )}

      {revealFor && (vault.unlocked || !vault.configured) ? (
        <RevealSecretsModal
          account={revealFor}
          onClose={() => setRevealFor(null)}
          onNeedUnlock={() => setVaultModal("unlock")}
        />
      ) : null}

      {vaultModal ? (
        <VaultPasswordModal
          mode="unlock"
          onClose={() => setVaultModal(null)}
          onDone={(s) => {
            setVault(s);
            setVaultModal(null);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
};
