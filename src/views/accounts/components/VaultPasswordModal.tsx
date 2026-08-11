import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { VaultStatus } from "@/types";

type Mode = "setup" | "unlock";

type Props = {
  mode: Mode;
  onClose: () => void;
  onDone: (status: VaultStatus) => void;
};

export const VaultPasswordModal = ({ mode, onClose, onDone }: Props) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setError("");
    if (password.trim().length < 6) {
      setError("主密码至少 6 位");
      return;
    }
    if (mode === "setup" && password !== confirm) {
      setError("两次输入不一致");
      return;
    }
    setBusy(true);
    try {
      const cmd = mode === "setup" ? "vault_setup" : "vault_unlock";
      const status = await invoke<VaultStatus>(cmd, { password });
      onDone(status);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="model-modal__header">
          <h2 className="model-modal__title">
            {mode === "setup" ? "设置主密码" : "解锁保险柜"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="model-modal__body">
          <p className="skill-modal__hint">
            {mode === "setup"
              ? "首次添加账号前需设置主密码，用于加密本机保存的密码与私钥。请妥善保管，应用不会保存明文主密码。"
              : "输入主密码以查看或编辑密码、私钥。解锁后约 30 分钟内有效。"}
          </p>
          <div className="mcp-form-row">
            <label>主密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              autoFocus
              autoComplete="off"
            />
          </div>
          {mode === "setup" ? (
            <div className="mcp-form-row">
              <label>确认主密码</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="再输入一次"
                autoComplete="off"
              />
            </div>
          ) : null}
          {error ? <div className="mcp-form-error">{error}</div> : null}
        </div>
        <div className="model-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "…" : mode === "setup" ? "创建并加密" : "解锁"}
          </button>
        </div>
      </div>
    </div>
  );
};
