import { useEffect, useState } from "react";
import { Select } from "@/components/Select";
import { invoke } from "@/hooks/useTauri";
import type { MediaPlatform, MediaPublishKind } from "@/types";

type FormState = {
  code: string;
  name: string;
  kind: MediaPublishKind;
  injectUrl: string;
  homeUrl: string;
  enabled: boolean;
  notes: string;
};

const KIND_OPTIONS = [
  { value: "dynamic", label: "动态" },
  { value: "article", label: "文章" },
  { value: "video", label: "视频" },
];

const emptyForm = (): FormState => ({
  code: "",
  name: "",
  kind: "dynamic",
  injectUrl: "",
  homeUrl: "",
  enabled: true,
  notes: "",
});

const fromPlatform = (p: MediaPlatform): FormState => ({
  code: p.code,
  name: p.name,
  kind: (p.kind as MediaPublishKind) || "dynamic",
  injectUrl: p.inject_url,
  homeUrl: p.home_url,
  enabled: p.enabled,
  notes: p.notes,
});

type Props = {
  mode: "add" | "edit";
  platform: MediaPlatform | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const MediaPlatformModal = ({
  mode,
  platform,
  onClose,
  onSaved,
}: Props) => {
  const [form, setForm] = useState<FormState>(
    mode === "edit" && platform ? fromPlatform(platform) : emptyForm(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(mode === "edit" && platform ? fromPlatform(platform) : emptyForm());
    setError("");
  }, [mode, platform]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setError("");
    setBusy(true);
    try {
      await invoke("media_platform_upsert", {
        id: mode === "edit" && platform ? platform.id : null,
        code: form.code.trim(),
        name: form.name.trim(),
        kind: form.kind,
        injectUrl: form.injectUrl.trim(),
        homeUrl: form.homeUrl.trim(),
        enabled: form.enabled,
        notes: form.notes.trim(),
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
        className="model-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-platform-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="media-platform-modal-title" className="model-modal__title">
            {mode === "edit" ? "编辑平台" : "添加平台"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="model-modal__body">
          <div className="mcp-form-row">
            <label>名称</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：小红书"
            />
          </div>
          <div className="mcp-form-row">
            <label>编码</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="如：DYNAMIC_REDNOTE"
            />
          </div>
          <div className="mcp-form-row">
            <label>类型</label>
            <Select
              aria-label="发布类型"
              value={form.kind}
              options={KIND_OPTIONS}
              onChange={(kind) =>
                setForm({ ...form, kind: kind as MediaPublishKind })
              }
            />
          </div>
          <div className="mcp-form-row">
            <label>注入页 URL</label>
            <input
              value={form.injectUrl}
              onChange={(e) => setForm({ ...form, injectUrl: e.target.value })}
              placeholder="扩展打开并注入脚本的页面"
            />
          </div>
          <div className="mcp-form-row">
            <label>主页 URL</label>
            <input
              value={form.homeUrl}
              onChange={(e) => setForm({ ...form, homeUrl: e.target.value })}
              placeholder="可选"
            />
          </div>
          <div className="mcp-form-row">
            <label>备注</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="可选说明"
            />
          </div>
          <label className="account-enabled">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <span>启用（扩展桥仅返回已启用平台）</span>
          </label>
          {error && <div className="mcp-form-error">{error}</div>}
        </div>

        <div className="model-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={!form.name.trim() || !form.code.trim() || busy}
          >
            {busy ? "保存中…" : mode === "edit" ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
};
