import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { KnowledgeEntry } from "@/types";

type FormState = {
  title: string;
  description: string;
  content: string;
  tags: string;
  visibility: "private" | "public";
  kind: "note" | "doc" | "faq";
  slug: string;
};

const emptyForm = (): FormState => ({
  title: "",
  description: "",
  content: "",
  tags: "",
  visibility: "private",
  kind: "note",
  slug: "",
});

const fromEntry = (e: KnowledgeEntry): FormState => ({
  title: e.title,
  description: e.description,
  content: e.content,
  tags: e.tags.join(", "),
  visibility: e.visibility === "public" ? "public" : "private",
  kind: e.kind === "doc" || e.kind === "faq" ? e.kind : "note",
  slug: e.slug ?? "",
});

const parseTags = (raw: string) =>
  raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

type Props = {
  mode: "add" | "edit";
  entry: KnowledgeEntry | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const KnowledgeModal = ({ mode, entry, onClose, onSaved }: Props) => {
  const [form, setForm] = useState<FormState>(
    mode === "edit" && entry ? fromEntry(entry) : emptyForm(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(mode === "edit" && entry ? fromEntry(entry) : emptyForm());
    setError("");
  }, [mode, entry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    setError("");
    const tags = parseTags(form.tags);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      content: form.content.trim(),
      tags,
      visibility: form.visibility,
      kind: form.kind,
      slug: form.slug.trim(),
    };
    try {
      if (mode === "edit" && entry) {
        await invoke("knowledge_update", { id: entry.id, ...payload });
      } else {
        await invoke("knowledge_add", payload);
      }
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
        className="model-modal skill-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="knowledge-modal-title" className="model-modal__title">
            {mode === "edit" ? "编辑知识" : "新建知识"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="model-modal__body">
          <p className="skill-modal__hint">
            默认私有，仅本机 Agent 检索；勾选「公开」后可导出到 chatcms.org
          </p>

          <div className="mcp-form-row">
            <label>标题</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="项目背景"
            />
          </div>
          <div className="mcp-form-row">
            <label>描述（用于匹配 / 公开摘要）</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="简短摘要，便于相关性匹配"
            />
          </div>
          <div className="mcp-form-row">
            <label>内容</label>
            <textarea
              className="skill-body"
              rows={8}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="将注入到提示词中的完整内容…"
            />
          </div>
          <div className="mcp-form-row">
            <label>标签（逗号分隔）</label>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="项目, 上下文, 规则"
            />
          </div>
          <div className="mcp-form-row">
            <label>类型</label>
            <select
              value={form.kind}
              onChange={(e) =>
                setForm({
                  ...form,
                  kind: e.target.value as FormState["kind"],
                })
              }
            >
              <option value="note">笔记</option>
              <option value="doc">文档</option>
              <option value="faq">FAQ</option>
            </select>
          </div>
          <div className="mcp-form-row">
            <label>可见性</label>
            <select
              value={form.visibility}
              onChange={(e) =>
                setForm({
                  ...form,
                  visibility: e.target.value as FormState["visibility"],
                })
              }
            >
              <option value="private">私有（仅本机）</option>
              <option value="public">公开（可发布到 chatcms.org）</option>
            </select>
          </div>
          {form.visibility === "public" ? (
            <div className="mcp-form-row">
              <label>公开路径 slug（可选）</label>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="留空则按标题生成，如 my-notes"
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
            disabled={!form.title.trim() || !form.content.trim() || busy}
            onClick={() => void save()}
          >
            {busy ? "保存中…" : mode === "edit" ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
};
