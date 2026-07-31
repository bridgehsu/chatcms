import { useEffect, useState } from "react";
import type { MapSection } from "../types";

type Props = {
  open: boolean;
  initial?: Pick<MapSection, "title" | "sort_order">;
  onClose: () => void;
  onSubmit: (title: string, sortOrder: number) => void;
};

export const MapSectionModal = ({ open, initial, onClose, onSubmit }: Props) => {
  const [title, setTitle] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setSortOrder(initial?.sort_order != null ? String(initial.sort_order) : "");
    setError("");
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isEdit = !!initial;

  const save = () => {
    const t = title.trim();
    if (!t) {
      setError("请填写导航名称");
      return;
    }
    onSubmit(t, sortOrder !== "" ? Number(sortOrder) : 999);
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
            {isEdit ? "编辑导航分类" : "新增导航分类"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="model-modal__body">
          <div className="mcp-form-row">
            <label>导航名称</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="例如：运营工具"
            />
          </div>
          <div className="mcp-form-row">
            <label>排序</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="数字越小越靠前"
              min={0}
            />
          </div>
          {error && <div className="mcp-form-error">{error}</div>}
        </div>
        <div className="model-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={save}>
            {isEdit ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
};
