import { useEffect, useState } from "react";
import { Select } from "@/components/Select";
import type { MapLink } from "../types";

type Props = {
  open: boolean;
  title: string;
  initial?: Omit<MapLink, "id">;
  onClose: () => void;
  onSubmit: (link: Omit<MapLink, "id">) => void;
};

const TONE_OPTIONS = [
  { value: "red", label: "红" },
  { value: "teal", label: "青" },
  { value: "amber", label: "琥珀" },
  { value: "blue", label: "蓝" },
  { value: "violet", label: "紫" },
  { value: "slate", label: "灰" },
] as const;

const EMPTY_FORM = { title: "", desc: "", mark: "", url: "", tone: "teal" as NonNullable<MapLink["tone"]> };

export const MapLinkModal = ({ open, title, initial, onClose, onSubmit }: Props) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? { title: initial.title, desc: initial.desc, mark: initial.mark, url: initial.url ?? "", tone: initial.tone ?? "teal" }
        : EMPTY_FORM
    );
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
    const name = form.title.trim();
    if (!name) {
      setError("请填写名称");
      return;
    }
    onSubmit({
      title: name,
      desc: form.desc.trim() || "自定义入口",
      mark: (form.mark.trim() || name.slice(0, 1)).slice(0, 2),
      url: form.url.trim() || undefined,
      tone: form.tone,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-link-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="map-link-modal-title" className="model-modal__title">
            {title}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="model-modal__body">
          <div className="mcp-form-row">
            <label>名称</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="例如：运营看板"
            />
          </div>
          <div className="mcp-form-row">
            <label>简介</label>
            <input
              value={form.desc}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
              placeholder="一句话说明"
            />
          </div>
          <div className="mcp-form-row">
            <label>角标文字</label>
            <input
              value={form.mark}
              onChange={(e) => setForm({ ...form, mark: e.target.value })}
              placeholder="1–2 个字"
              maxLength={2}
            />
          </div>
          <div className="mcp-form-row">
            <label>链接（可选）</label>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="#/chat 或 https://…"
            />
          </div>
          <div className="mcp-form-row">
            <label>色调</label>
            <Select
              aria-label="色调"
              value={form.tone}
              options={[...TONE_OPTIONS]}
              onChange={(tone) => setForm({ ...form, tone })}
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
