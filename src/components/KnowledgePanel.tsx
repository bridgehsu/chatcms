import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { KnowledgeEntry } from "../types";

export function KnowledgePanel() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", content: "", tags: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = () =>
    invoke<KnowledgeEntry[]>("knowledge_list").then(setEntries).catch(console.error);

  useEffect(() => { refresh(); }, []);

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
        <span className="mcp-title">Agent Memory ({entries.length})</span>
        <button className="btn-mcp-add" onClick={() => setAdding(true)}>
          + Add Entry
        </button>
      </div>
      <p className="mcp-empty" style={{ fontSize: 11, marginTop: -4 }}>
        Relevant entries are automatically injected into the system prompt.
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
              onClick={() => remove(e.id)}
              disabled={busy === e.id}
            >
              {busy === e.id ? "…" : "Remove"}
            </button>
          </div>
        ))}
        {entries.length === 0 && !adding && (
          <p className="mcp-empty">No knowledge entries yet.</p>
        )}
      </div>

      {adding && (
        <div className="mcp-add-form">
          <div className="mcp-form-row">
            <label>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="My Project Context"
            />
          </div>
          <div className="mcp-form-row">
            <label>Description (used for matching)</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief summary for relevance matching"
            />
          </div>
          <div className="mcp-form-row">
            <label>Content</label>
            <textarea
              className="mcp-env-input"
              rows={5}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Full content injected into the prompt…"
            />
          </div>
          <div className="mcp-form-row">
            <label>Tags (comma-separated)</label>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="project, context, rules"
            />
          </div>
          {error && <div className="mcp-form-error">{error}</div>}
          <div className="modal-actions" style={{ marginTop: 0 }}>
            <button onClick={() => { setAdding(false); setError(""); }}>Cancel</button>
            <button
              className="btn-primary"
              onClick={add}
              disabled={!form.title || !form.content || busy === "add"}
            >
              {busy === "add" ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
