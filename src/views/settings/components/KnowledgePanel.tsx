import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { KnowledgeEntry } from "@/types";

export const KnowledgePanel = () => {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", content: "", tags: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = () =>
    invoke<KnowledgeEntry[]>("knowledge_list").then(setEntries).catch(console.error);

  useEffect(() => {
    refresh();
  }, []);

  const add = async () => {
    setError("");
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    setBusy("add");
    try {
      await invoke("knowledge_add", {
        title: form.title,
        description: form.description,
        content: form.content,
        tags,
      });
      setForm({ title: "", description: "", content: "", tags: "" });
      setAdding(false);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    await invoke("knowledge_remove", { id }).catch(console.error);
    setBusy(null);
    refresh();
  };

  return (
    <div className="mcp-panel">
      <div className="mcp-header">
        <span className="mcp-title">Agent 记忆（{entries.length}）</span>
        <button className="btn-mcp-add" onClick={() => setAdding(true)} type="button">
          + 添加条目
        </button>
      </div>
      <p className="mcp-empty" style={{ fontSize: 11, marginTop: -4 }}>
        相关条目会自动注入到系统提示词中。
      </p>

      <div className="mcp-server-list">
        {entries.map((e) => (
          <div key={e.id} className="mcp-server-row">
            <div className="mcp-server-left" style={{ flexDirection: "column", gap: 2 }}>
              <div className="mcp-server-name">{e.title}</div>
              <div className="mcp-server-cmd">{e.description}</div>
              {e.tags.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                  {e.tags.map((t) => (
                    <span key={t} className="knowledge-tag">{t}</span>
                  ))}
                </div>
              )}
            </div>
            <button
              className="btn-mcp-remove"
              onClick={() => void remove(e.id)}
              disabled={busy === e.id}
              type="button"
            >
              {busy === e.id ? "…" : "移除"}
            </button>
          </div>
        ))}
        {entries.length === 0 && !adding && (
          <p className="mcp-empty">暂无记忆条目</p>
        )}
      </div>

      {adding && (
        <div className="mcp-add-form">
          <div className="mcp-form-row">
            <label>标题</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="项目背景"
            />
          </div>
          <div className="mcp-form-row">
            <label>描述（用于匹配）</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="简短摘要，便于相关性匹配"
            />
          </div>
          <div className="mcp-form-row">
            <label>内容</label>
            <textarea
              className="mcp-env-input"
              rows={5}
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
          {error && <div className="mcp-form-error">{error}</div>}
          <div className="modal-actions" style={{ marginTop: 0 }}>
            <button
              onClick={() => {
                setAdding(false);
                setError("");
              }}
              type="button"
            >
              取消
            </button>
            <button
              className="btn-primary"
              onClick={() => void add()}
              disabled={!form.title || !form.content || busy === "add"}
              type="button"
            >
              {busy === "add" ? "保存中…" : "添加"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
