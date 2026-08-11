import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { PlatformAccount, RevealedSecrets } from "@/types";

type Props = {
  account: PlatformAccount;
  onClose: () => void;
  onNeedUnlock: () => void;
};

export const RevealSecretsModal = ({ account, onClose, onNeedUnlock }: Props) => {
  const [secrets, setSecrets] = useState<RevealedSecrets | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    void invoke<RevealedSecrets>("account_reveal", { id: account.id })
      .then((r) => {
        if (!cancelled) setSecrets(r);
      })
      .catch((e) => {
        const msg = String(e);
        if (!cancelled) {
          setError(msg);
          if (msg.includes("解锁") || msg.includes("锁定")) onNeedUnlock();
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account.id, onNeedUnlock]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
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
          <h2 className="model-modal__title">查看敏感信息 · {account.name}</h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="model-modal__body">
          {busy ? <p className="skill-modal__hint">解密中…</p> : null}
          {error ? <div className="mcp-form-error">{error}</div> : null}
          {secrets ? (
            <>
              <div className="mcp-form-row">
                <label>用户名</label>
                <div className="account-reveal__row">
                  <code className="account-reveal__value">
                    {account.name || "—"}
                  </code>
                  {account.name ? (
                    <button
                      type="button"
                      className="btn-mcp-action"
                      onClick={() => void copy(account.name)}
                    >
                      复制
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mcp-form-row">
                <label>手机号</label>
                <div className="account-reveal__row">
                  <code className="account-reveal__value">
                    {account.phone || "—"}
                  </code>
                  {account.phone ? (
                    <button
                      type="button"
                      className="btn-mcp-action"
                      onClick={() => void copy(account.phone)}
                    >
                      复制
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mcp-form-row">
                <label>邮箱</label>
                <div className="account-reveal__row">
                  <code className="account-reveal__value">
                    {account.email || "—"}
                  </code>
                  {account.email ? (
                    <button
                      type="button"
                      className="btn-mcp-action"
                      onClick={() => void copy(account.email)}
                    >
                      复制
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mcp-form-row">
                <label>公钥</label>
                <div className="account-reveal__row">
                  <code className="account-reveal__value">
                    {account.account_id || "—"}
                  </code>
                  {account.account_id ? (
                    <button
                      type="button"
                      className="btn-mcp-action"
                      onClick={() => void copy(account.account_id)}
                    >
                      复制
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mcp-form-row">
                <label>密码</label>
                <div className="account-reveal__row">
                  <code className="account-reveal__value">
                    {secrets.access_key || "—"}
                  </code>
                  {secrets.access_key ? (
                    <button
                      type="button"
                      className="btn-mcp-action"
                      onClick={() => void copy(secrets.access_key)}
                    >
                      复制
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mcp-form-row">
                <label>私钥</label>
                <div className="account-reveal__row">
                  <code className="account-reveal__value">
                    {secrets.secret_key || "—"}
                  </code>
                  {secrets.secret_key ? (
                    <button
                      type="button"
                      className="btn-mcp-action"
                      onClick={() => void copy(secrets.secret_key)}
                    >
                      复制
                    </button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
        <div className="model-modal__footer">
          <button type="button" className="btn-primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
