import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { TelegramStatus } from "@/types";

export const ChannelPanel = () => {
  const [status, setStatus] = useState<TelegramStatus>({
    token: "",
    allowed_ids: [],
    running: false,
  });
  const [token, setToken] = useState("");
  const [allowedIds, setAllowedIds] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const s = await invoke<TelegramStatus>("channel_telegram_get").catch(() => null);
    if (s) {
      setStatus(s);
      setToken(s.token);
      setAllowedIds(s.allowed_ids.join(", "));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async () => {
    setError("");
    setBusy(true);
    const ids = allowedIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await invoke("channel_telegram_set", { token, allowedIds: ids });
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    setError("");
    setBusy(true);
    try {
      if (status.running) {
        await invoke("channel_telegram_stop");
      } else {
        await invoke("channel_telegram_start");
      }
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mcp-panel">
      <div className="mcp-header">
        <span className="mcp-title">Telegram 机器人</span>
        <span
          className={`mcp-dot ${status.running ? "connected" : "disconnected"}`}
          style={{ width: 10, height: 10 }}
        />
      </div>
      <p className="mcp-empty" style={{ fontSize: 11, marginTop: -4 }}>
        启动后可通过 Telegram 与 Agent 对话。
      </p>

      <div className="mcp-add-form">
        <div className="mcp-form-row">
          <label>Bot Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="123456:ABC-DEF..."
          />
        </div>
        <div className="mcp-form-row">
          <label>允许的 Chat ID（逗号分隔，* 表示全部）</label>
          <input
            value={allowedIds}
            onChange={(e) => setAllowedIds(e.target.value)}
            placeholder="123456789, 987654321 或 *"
          />
        </div>
        {error && <div className="mcp-form-error">{error}</div>}
        <div className="modal-actions" style={{ marginTop: 0 }}>
          <button onClick={() => void save()} disabled={busy} type="button">
            {busy ? "…" : "保存"}
          </button>
          <button
            className={status.running ? "btn-deny" : "btn-allow"}
            onClick={() => void toggle()}
            disabled={busy || !status.token}
            style={{ padding: "8px 20px" }}
            type="button"
          >
            {busy ? "…" : status.running ? "停止机器人" : "启动机器人"}
          </button>
        </div>
      </div>

      {status.running && (
        <div className="channel-status-box">
          机器人运行中。在 Telegram 向机器人发消息即可开始对话。
        </div>
      )}
    </div>
  );
};
