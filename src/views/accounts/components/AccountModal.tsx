import { useEffect, useState } from "react";
import { getPlatform } from "@/config/platformPresets";
import { invoke } from "@/hooks/useTauri";
import type { PlatformAccount, RevealedSecrets, VaultStatus } from "@/types";

type FormState = {
  name: string;
  platform: string;
  phone: string;
  email: string;
  accountId: string;
  accessKey: string;
  secretKey: string;
  enabled: boolean;
  notes: string;
};

const emptyForm = (): FormState => ({
  name: "",
  platform: "",
  phone: "",
  email: "",
  accountId: "",
  accessKey: "",
  secretKey: "",
  enabled: true,
  notes: "",
});

type Props = {
  mode: "add" | "edit";
  account: PlatformAccount | null;
  vault: VaultStatus;
  onVaultChange: (status: VaultStatus) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const AccountModal = ({
  mode,
  account,
  vault,
  onVaultChange,
  onClose,
  onSaved,
}: Props) => {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secretsLoaded, setSecretsLoaded] = useState(mode === "add");
  const [secretsDirty, setSecretsDirty] = useState(mode === "add");
  const [masterPassword, setMasterPassword] = useState("");
  const [masterConfirm, setMasterConfirm] = useState("");

  const needSetup = !vault.configured;
  const needUnlock = vault.configured && !vault.unlocked;

  useEffect(() => {
    setError("");
    setMasterPassword("");
    setMasterConfirm("");
    if (mode === "edit" && account) {
      setForm({
        name: account.name,
        platform: account.platform || "",
        phone: account.phone || "",
        email: account.email || "",
        accountId: account.account_id,
        accessKey: "",
        secretKey: "",
        enabled: account.enabled,
        notes: account.notes,
      });
      setSecretsLoaded(false);
      setSecretsDirty(false);
      if (!vault.configured || vault.unlocked) {
        void invoke<RevealedSecrets>("account_reveal", { id: account.id })
          .then((r) => {
            setForm((f) => ({
              ...f,
              accessKey: r.access_key,
              secretKey: r.secret_key,
            }));
            setSecretsLoaded(true);
          })
          .catch(() => {
            setSecretsLoaded(false);
          });
      }
    } else {
      setForm(emptyForm());
      setSecretsLoaded(true);
      setSecretsDirty(true);
    }
  }, [mode, account, vault.configured, vault.unlocked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preset = getPlatform(form.platform);

  const ensureVaultReady = async (): Promise<boolean> => {
    if (vault.unlocked && vault.configured) return true;

    if (needSetup) {
      if (masterPassword.trim().length < 6) {
        setError("主密码至少 6 位");
        return false;
      }
      if (masterPassword !== masterConfirm) {
        setError("两次主密码不一致");
        return false;
      }
      const status = await invoke<VaultStatus>("vault_setup", {
        password: masterPassword,
      });
      onVaultChange(status);
      return true;
    }

    if (needUnlock) {
      if (!masterPassword.trim()) {
        setError("请输入主密码以解锁保险柜");
        return false;
      }
      const status = await invoke<VaultStatus>("vault_unlock", {
        password: masterPassword,
      });
      onVaultChange(status);
      return true;
    }

    return true;
  };

  const save = async () => {
    setError("");
    const username = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const accountId = form.accountId.trim();
    const accessKey = form.accessKey.trim();
    const secretKey = form.secretKey.trim();
    const platform = form.platform.trim();

    if (mode === "add") {
      if (!platform) {
        setError("请填写平台");
        return;
      }
      if (!username) {
        setError("请填写用户名");
        return;
      }
      if (!phone) {
        setError("请填写手机号");
        return;
      }
      if (!email) {
        setError("请填写邮箱");
        return;
      }
      if (!accountId) {
        setError("请填写公钥");
        return;
      }
      if (!accessKey) {
        setError("请填写密码");
        return;
      }
      if (!secretKey) {
        setError("请填写私钥");
        return;
      }
    } else if (!platform) {
      setError("请填写平台");
      return;
    } else if (!username) {
      setError("请填写用户名");
      return;
    }

    setBusy(true);
    try {
      if (mode === "add" || secretsDirty) {
        const ok = await ensureVaultReady();
        if (!ok) return;
      }

      const payload = {
        name: username,
        platform,
        phone,
        email,
        accountId,
        accessKey: mode === "add" || secretsDirty ? accessKey : form.accessKey,
        secretKey: mode === "add" || secretsDirty ? secretKey : form.secretKey,
        enabled: form.enabled,
        notes: form.notes.trim(),
      };

      if (mode === "edit" && account) {
        await invoke("account_update", {
          id: account.id,
          ...payload,
          updateSecrets: secretsDirty,
        });
      } else {
        await invoke("account_add", payload);
      }
      await onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const masterOkForAdd =
    (!needSetup ||
      (masterPassword.trim().length >= 6 && masterPassword === masterConfirm)) &&
    (!needUnlock || Boolean(masterPassword.trim()));

  const canSubmit =
    mode === "add"
      ? Boolean(
          form.platform.trim() &&
            form.name.trim() &&
            form.phone.trim() &&
            form.email.trim() &&
            form.accountId.trim() &&
            form.accessKey.trim() &&
            form.secretKey.trim() &&
            masterOkForAdd,
        )
      : Boolean(form.platform.trim() && form.name.trim());

  const showSecretFields = mode === "add" || vault.unlocked || !vault.configured;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="account-modal-title" className="model-modal__title">
            {mode === "edit" ? "编辑账号" : "添加账号"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="model-modal__body">
          <div className="mcp-form-row">
            <label>平台</label>
            <input
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              placeholder="例如：微信公众号 / 抖音 / 小红书"
            />
          </div>
          <div className="mcp-form-row">
            <label>用户名</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="登录用户名 / 账号昵称"
            />
          </div>
          <div className="mcp-form-row">
            <label>手机号</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="11 位手机号"
            />
          </div>
          <div className="mcp-form-row">
            <label>邮箱</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@example.com"
            />
          </div>
          <div className="mcp-form-row">
            <label>公钥</label>
            <input
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              placeholder={preset.accountIdPlaceholder}
            />
          </div>

          {mode === "edit" && needUnlock ? (
            <p className="skill-modal__hint">
              密码与私钥已加密，请先在列表中「解锁」后再编辑敏感字段；其余信息仍可直接保存。
            </p>
          ) : null}

          {showSecretFields ? (
            <>
              {!secretsLoaded && mode === "edit" ? (
                <p className="skill-modal__hint">正在载入敏感字段…</p>
              ) : null}
              <div className="mcp-form-row">
                <label>密码</label>
                <input
                  type="password"
                  value={form.accessKey}
                  onChange={(e) => {
                    setForm({ ...form, accessKey: e.target.value });
                    setSecretsDirty(true);
                  }}
                  placeholder={preset.accessKeyPlaceholder}
                  autoComplete="off"
                />
              </div>
              <div className="mcp-form-row">
                <label>私钥</label>
                <input
                  type="password"
                  value={form.secretKey}
                  onChange={(e) => {
                    setForm({ ...form, secretKey: e.target.value });
                    setSecretsDirty(true);
                  }}
                  placeholder={preset.secretKeyPlaceholder}
                  autoComplete="off"
                />
              </div>
            </>
          ) : null}

          <div className="mcp-form-row">
            <label>备注</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="用途说明、负责人等（可选）"
              rows={3}
            />
          </div>
          <label className="account-enabled">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <span>启用此账号</span>
          </label>

          {needSetup ? (
            <>
              <p className="skill-modal__hint">
                首次添加需同时设置主密码，用于加密保存密码与私钥。
              </p>
              <div className="mcp-form-row">
                <label>主密码</label>
                <input
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="至少 6 位"
                  autoComplete="off"
                />
              </div>
              <div className="mcp-form-row">
                <label>确认主密码</label>
                <input
                  type="password"
                  value={masterConfirm}
                  onChange={(e) => setMasterConfirm(e.target.value)}
                  placeholder="再输入一次"
                  autoComplete="off"
                />
              </div>
            </>
          ) : null}

          {needUnlock && !needSetup && (mode === "add" || secretsDirty) ? (
            <>
              <p className="skill-modal__hint">保险柜已锁定，保存前请输入主密码。</p>
              <div className="mcp-form-row">
                <label>主密码</label>
                <input
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="解锁保险柜"
                  autoComplete="off"
                />
              </div>
            </>
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
            onClick={() => void save()}
            disabled={!canSubmit || busy}
          >
            {busy ? "保存中…" : mode === "edit" ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
};
