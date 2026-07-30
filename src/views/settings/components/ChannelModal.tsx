import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/Select";
import { CHANNEL_PRESETS } from "@/config/channelPresets";
import { invoke } from "@/hooks/useTauri";
import type { ChannelDetail, ChannelInfo, ChannelKind } from "@/types";

type Props = {
  mode: "add" | "edit";
  channel: ChannelInfo | null;
  /** 新增时可选的平台（通常为尚未配置的） */
  availableKinds?: ChannelKind[];
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const ChannelModal = ({
  mode,
  channel,
  availableKinds,
  onClose,
  onSaved,
}: Props) => {
  const kindOptions = useMemo(() => {
    const kinds =
      mode === "add"
        ? (availableKinds ?? CHANNEL_PRESETS.map((p) => p.kind))
        : channel
          ? [channel.kind as ChannelKind]
          : [];
    return CHANNEL_PRESETS.filter((p) => kinds.includes(p.kind)).map((p) => ({
      value: p.kind,
      label: p.label,
    }));
  }, [mode, channel, availableKinds]);

  const [kind, setKind] = useState<ChannelKind>(
    (channel?.kind as ChannelKind) || kindOptions[0]?.value || "telegram",
  );
  const [token, setToken] = useState("");
  const [allowedIds, setAllowedIds] = useState("");
  const [webhook, setWebhook] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(mode === "edit");

  const meta =
    CHANNEL_PRESETS.find((p) => p.kind === kind) ??
    (channel
      ? {
          kind: channel.kind as ChannelKind,
          label: channel.label,
          description: channel.description,
        }
      : CHANNEL_PRESETS[0]);

  useEffect(() => {
    if (mode === "edit" && channel) {
      setKind(channel.kind as ChannelKind);
    } else if (kindOptions[0]) {
      setKind(kindOptions[0].value);
    }
  }, [mode, channel, kindOptions]);

  useEffect(() => {
    setError("");
    if (mode === "add") {
      setToken("");
      setAllowedIds("");
      setWebhook("");
      setNotes("");
      setLoading(false);
      return;
    }
    setLoading(true);
    void invoke<ChannelDetail>("channel_get", { kind })
      .then((d) => {
        setToken(d.token ?? "");
        setAllowedIds((d.allowed_ids ?? []).join(", "));
        setWebhook(d.webhook ?? "");
        setNotes(d.notes ?? "");
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [mode, kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const ids = allowedIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await invoke("channel_update", {
        kind,
        token: token.trim(),
        allowedIds: kind === "telegram" ? ids : null,
        webhook: kind === "telegram" ? null : webhook.trim(),
        notes: kind === "telegram" ? null : notes.trim(),
      });
      await onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal skill-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="channel-modal-title" className="model-modal__title">
            {mode === "edit" ? `配置 ${meta.label}` : "新增渠道"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="model-modal__body">
          {mode === "add" ? (
            <div className="mcp-form-row">
              <label>平台</label>
              <Select
                value={kind}
                options={kindOptions}
                onChange={setKind}
                aria-label="选择渠道平台"
              />
            </div>
          ) : null}

          <p className="skill-modal__hint">{meta.description}</p>
          {channel && !channel.supported && mode === "edit" ? (
            <p className="skill-modal__hint">
              该渠道运行时即将接入；可先填写凭证，暂不可启用。
            </p>
          ) : null}
          {mode === "add" && kind !== "telegram" ? (
            <p className="skill-modal__hint">
              该渠道运行时即将接入；可先填写凭证，暂不可启用。
            </p>
          ) : null}

          {loading ? (
            <p className="skill-modal__hint">加载中…</p>
          ) : kind === "telegram" ? (
            <>
              <div className="mcp-form-row">
                <label>Bot Token</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="123456:ABC-DEF…"
                />
              </div>
              <div className="mcp-form-row">
                <label>允许的 Chat ID（逗号分隔，* 表示全部）</label>
                <input
                  value={allowedIds}
                  onChange={(e) => setAllowedIds(e.target.value)}
                  placeholder="123456789 或 *"
                />
              </div>
            </>
          ) : (
            <>
              <div className="mcp-form-row">
                <label>Token / App Secret</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="凭证（可选，预留）"
                />
              </div>
              <div className="mcp-form-row">
                <label>Webhook / 回调地址</label>
                <input
                  value={webhook}
                  onChange={(e) => setWebhook(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="mcp-form-row">
                <label>备注</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="可选说明"
                />
              </div>
            </>
          )}

          {error ? <div className="mcp-form-error">{error}</div> : null}
        </div>

        <div className="model-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || loading || kindOptions.length === 0}
            onClick={() => void save()}
          >
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
};
