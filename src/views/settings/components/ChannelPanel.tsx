import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { CHANNEL_PRESETS } from "@/config/channelPresets";
import { invoke } from "@/hooks/useTauri";
import type { ChannelInfo, ChannelKind } from "@/types";
import { ChannelModal } from "./ChannelModal";

const statusLabel = (c: ChannelInfo) => {
  if (c.enabled) return "运行中";
  if (c.status === "coming_soon") return "即将支持";
  if (c.configured) return "已配置";
  return "未配置";
};

const statusClass = (c: ChannelInfo) => {
  if (c.enabled) return "mcp-badge mcp-badge--ok";
  if (c.status === "coming_soon") return "mcp-badge";
  if (c.configured) return "mcp-badge mcp-badge--ok";
  return "mcp-badge";
};

export const ChannelPanel = () => {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<ChannelInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const list = await invoke<ChannelInfo[]>("plugin:channels|channel_list");
    setChannels(list);
  };

  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
  }, []);

  /** 表格只展示已配置 / 运行中的渠道 */
  const configured = useMemo(
    () => channels.filter((c) => c.configured || c.enabled),
    [channels],
  );

  const availableKinds = useMemo(
    () =>
      CHANNEL_PRESETS.map((p) => p.kind).filter(
        (kind) => !channels.some((c) => c.kind === kind && c.configured),
      ),
    [channels],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return configured;
    return configured.filter((c) =>
      [c.label, c.kind, c.description].join(" ").toLowerCase().includes(q),
    );
  }, [configured, query]);

  const openAdd = () => {
    setError("");
    if (availableKinds.length === 0) {
      setError("所有平台均已添加，请直接编辑表格中的渠道");
      return;
    }
    setEditing(null);
    setMode("add");
  };

  const openEdit = (c: ChannelInfo) => {
    setError("");
    setEditing(c);
    setMode("edit");
  };

  const closeModal = () => {
    setMode("idle");
    setEditing(null);
  };

  const toggle = async (c: ChannelInfo, e: MouseEvent) => {
    e.stopPropagation();
    setError("");
    setBusy(`toggle-${c.kind}`);
    try {
      if (c.enabled) {
        const list = await invoke<ChannelInfo[]>("plugin:channels|channel_disable", {
          kind: c.kind,
        });
        setChannels(list);
      } else {
        if (!c.supported) {
          setError(`${c.label} 即将接入，暂不可启用`);
          return;
        }
        if (!c.configured) {
          setError(`请先配置 ${c.label}`);
          openEdit(c);
          return;
        }
        const list = await invoke<ChannelInfo[]>("plugin:channels|channel_enable", {
          kind: c.kind,
        });
        setChannels(list);
      }
    } catch (err) {
      setError(String(err));
      await refresh().catch(() => undefined);
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
              placeholder="搜索渠道…"
              aria-label="搜索渠道"
            />
          </div>
        </div>
        <button className="model-btn-add" onClick={openAdd} type="button">
          + 新增渠道
        </button>
      </div>

      {error ? <div className="mcp-form-error">{error}</div> : null}

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th className="model-table__idx">#</th>
              <th>渠道</th>
              <th>说明</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="model-table__empty">
                  {configured.length === 0
                    ? "暂无渠道，点击右上角新增"
                    : "没有匹配的渠道"}
                </td>
              </tr>
            ) : (
              filtered.map((c, index) => (
                <tr
                  key={c.kind}
                  className="model-table__row"
                  onClick={() => openEdit(c)}
                >
                  <td className="model-table__idx model-table__mono">
                    {index + 1}
                  </td>
                  <td>
                    <span className="model-table__name">{c.label}</span>
                    <div className="account-table__notes">{c.kind}</div>
                  </td>
                  <td>
                    <div className="skill-table__desc">{c.description}</div>
                  </td>
                  <td>
                    <span className={statusClass(c)}>{statusLabel(c)}</span>
                  </td>
                  <td>
                    <div
                      className="model-table__actions"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <button
                        className="btn-mcp-action"
                        type="button"
                        onClick={() => openEdit(c)}
                      >
                        配置
                      </button>
                      <button
                        className={
                          c.enabled ? "btn-mcp-remove" : "btn-mcp-action"
                        }
                        type="button"
                        disabled={
                          busy === `toggle-${c.kind}` ||
                          (!c.enabled && !c.supported)
                        }
                        title={!c.supported ? "即将支持" : undefined}
                        onClick={(ev) => void toggle(c, ev)}
                      >
                        {busy === `toggle-${c.kind}`
                          ? "…"
                          : c.enabled
                            ? "停用"
                            : "启用"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {mode === "add" || mode === "edit" ? (
        <ChannelModal
          mode={mode}
          channel={editing}
          availableKinds={availableKinds as ChannelKind[]}
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
