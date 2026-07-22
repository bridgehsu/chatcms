import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TelegramStatus } from "../types";

export function ChannelPanel() {
  const [status, setStatus] = useState<TelegramStatus>({
    token: "",
    allowed_ids: [],
    running: false,
  });
  const [token, setToken] = useState("");
  const [allowedIds, setAllowedIds] = useState(""); // comma-separated
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

  useEffect(() => { refresh(); }, []);

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
        <span className="mcp-title">Telegram Bot</span>
        <span className={`mcp-dot ${status.running ? "connected" : "disconnected"}`} style={{ width: 10, height: 10 }} />
      </div>
      <p className="mcp-empty" style={{ fontSize: 11, marginTop: -4 }}>
        Start a bot to chat with your agent via Telegram.
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
          <label>Allowed Chat IDs (comma-separated, * = allow all)</label>
          <input
            value={allowedIds}
            onChange={(e) => setAllowedIds(e.target.value)}
            placeholder="123456789, 987654321  or  *"
          />
        </div>
        {error && <div className="mcp-form-error">{error}</div>}
        <div className="modal-actions" style={{ marginTop: 0 }}>
          <button onClick={save} disabled={busy}>
            {busy ? "…" : "Save"}
          </button>
          <button
            className={status.running ? "btn-deny" : "btn-allow"}
            onClick={toggle}
            disabled={busy || !status.token}
            style={{ padding: "8px 20px" }}
          >
            {busy ? "…" : status.running ? "Stop Bot" : "Start Bot"}
          </button>
        </div>
      </div>

      {status.running && (
        <div className="channel-status-box">
          Bot is running. Send a message to your bot on Telegram to start chatting.
        </div>
      )}
    </div>
  );
}
