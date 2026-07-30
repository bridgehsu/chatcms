import { useEffect, useState } from "react";
import type { CustomNavEntry } from "../hooks/useCustomNav";

type Props = {
  entry: CustomNavEntry | null; // null = 新增模式
  onClose: () => void;
  onSave: (label: string, path: string, sortOrder: number) => void;
};

const emptyForm = () => ({ label: "", path: "", sortOrder: 50 });
const fromEntry = (e: CustomNavEntry) => ({
  label: e.label,
  path: e.path,
  sortOrder: e.sortOrder,
});

export const NavCustomModal = ({ entry, onClose, onSave }: Props) => {
  const [form, setForm] = useState(entry ? fromEntry(entry) : emptyForm());
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(entry ? fromEntry(entry) : emptyForm());
    setError("");
  }, [entry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = () => {
    const label = form.label.trim();
    const path = form.path.trim();
    if (!label) return setError("名称不能为空");
    if (!path) return setError("路径不能为空");
    onSave(label, path, form.sortOrder);
    onClose();
  };

  const isEdit = entry !== null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nav-custom-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="nav-custom-modal-title" className="model-modal__title">
            {isEdit ? "编辑分类" : "新增分类"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="model-modal__body">
          <div className="mcp-form-row">
            <label>名称</label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="如：我的工作台"
              autoFocus
            />
          </div>
          <div className="mcp-form-row">
            <label>路径</label>
            <input
              value={form.path}
              onChange={(e) => setForm({ ...form, path: e.target.value })}
              placeholder="如：/my-page 或 https://…"
            />
          </div>
          <div className="mcp-form-row">
            <label>排序</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) =>
                setForm({ ...form, sortOrder: Number(e.target.value) })
              }
              placeholder="数字越小越靠前"
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
            onClick={handleSave}
            disabled={!form.label.trim() || !form.path.trim()}
          >
            {isEdit ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
};
