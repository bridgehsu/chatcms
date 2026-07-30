import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { NavBookmark } from "@/types";

type FormState = {
  title: string;
  url: string;
  note: string;
};

const emptyForm = (): FormState => ({
  title: "",
  url: "",
  note: "",
});

const fromBookmark = (b: NavBookmark): FormState => ({
  title: b.title,
  url: b.url,
  note: b.note || "",
});

type Props = {
  mode: "add" | "edit";
  bookmark: NavBookmark | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const NavBookmarkModal = ({
  mode,
  bookmark,
  onClose,
  onSaved,
}: Props) => {
  const [form, setForm] = useState<FormState>(
    mode === "edit" && bookmark ? fromBookmark(bookmark) : emptyForm(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(mode === "edit" && bookmark ? fromBookmark(bookmark) : emptyForm());
    setError("");
  }, [mode, bookmark]);

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
      await invoke("nav_bookmark_upsert", {
        id: mode === "edit" && bookmark ? bookmark.id : null,
        title: form.title.trim(),
        url: form.url.trim(),
        note: form.note.trim(),
        sortOrder: mode === "edit" && bookmark ? bookmark.sort_order : null,
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
        aria-labelledby="nav-bookmark-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="nav-bookmark-modal-title" className="model-modal__title">
            {mode === "edit" ? "编辑导航" : "添加导航"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="model-modal__body">
          <div className="mcp-form-row">
            <label>名称</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="如：小红书创作者中心"
            />
          </div>
          <div className="mcp-form-row">
            <label>链接</label>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div className="mcp-form-row">
            <label>备注</label>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="可选"
            />
          </div>
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
            disabled={!form.title.trim() || !form.url.trim() || busy}
          >
            {busy ? "保存中…" : mode === "edit" ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
};
