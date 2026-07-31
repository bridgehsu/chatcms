import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string, icon: string) => void;
};

export const MapSectionModal = ({ open, onClose, onSubmit }: Props) => {
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setIcon("");
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const save = () => {
    const t = title.trim();
    if (!t) {
      setError("请填写分区名称");
      return;
    }
    onSubmit(t, icon.trim() || "📁");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-section-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="map-section-modal-title" className="model-modal__title">
            新增分区
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="model-modal__body">
          <div className="mcp-form-row">
            <label>分区名称</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="例如：运营工具"
            />
          </div>
          <div className="mcp-form-row">
            <label>图标（emoji）</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="默认 📁"
              maxLength={4}
            />
          </div>
          {error && <div className="mcp-form-error">{error}</div>}
        </div>
        <div className="model-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={save}>
            添加
          </button>
        </div>
      </div>
    </div>
  );
};
