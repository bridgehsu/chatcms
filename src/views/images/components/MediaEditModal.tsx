import { useEffect, useState } from "react";

type Props = {
  title: string;
  note: string;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (title: string, note: string) => Promise<void>;
};

/** 修改素材名称与备注 */
export const MediaEditModal = ({
  title: initialTitle,
  note: initialNote,
  busy = false,
  error = "",
  onClose,
  onSave,
}: Props) => {
  const [title, setTitle] = useState(initialTitle);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setTitle(initialTitle);
    setNote(initialNote);
    setLocalError("");
  }, [initialTitle, initialNote]);

  const submit = async () => {
    const t = title.trim();
    if (!t || saving || busy) return;
    setSaving(true);
    setLocalError("");
    try {
      await onSave(t, note);
      onClose();
    } catch (e) {
      setLocalError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const err = localError || error;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="media-edit-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-edit-title"
      >
        <div className="media-edit-modal__head">
          <h3 id="media-edit-title" className="media-edit-modal__title">
            修改
          </h3>
          <button
            type="button"
            className="model-modal__close"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>
        <div className="media-edit-modal__body">
          <label className="media-edit-modal__label" htmlFor="media-edit-name">
            名称
          </label>
          <input
            id="media-edit-name"
            className="media-edit-modal__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
            disabled={saving}
          />
          <label className="media-edit-modal__label" htmlFor="media-edit-note">
            备注
          </label>
          <textarea
            id="media-edit-note"
            className="media-edit-modal__textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="可选，补充说明用途、来源等"
            disabled={saving}
          />
          {err ? <div className="media-edit-modal__error">{err}</div> : null}
        </div>
        <div className="media-edit-modal__footer">
          <button
            type="button"
            className="btn-ghost"
            disabled={saving}
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving || !title.trim()}
            onClick={() => void submit()}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
};
