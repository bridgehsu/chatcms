import type { AiNote } from "../types";

type Props = {
  note: AiNote | null;
  onChange: (patch: Partial<Pick<AiNote, "title" | "content" | "icon">>) => void;
  onPublish?: (note: AiNote) => void;
};

export const NoteEditor = ({ note, onChange, onPublish }: Props) => {
  if (!note) {
    return (
      <div className="note-editor note-editor--empty">
        <p>选择左侧笔记，或新建一篇 AI 笔记</p>
      </div>
    );
  }

  return (
    <div className="note-editor">
      <div className="note-editor__toolbar">
        <button
          type="button"
          className="btn-primary"
          disabled={!note.content.trim() && !note.title.trim()}
          onClick={() => onPublish?.(note)}
        >
          发布到浏览器
        </button>
      </div>
      <div className="note-editor__canvas">
        <button
          type="button"
          className="note-editor__emoji"
          title="更换图标"
          onClick={() => {
            const icons = ["✨", "📄", "🧠", "📌", "💡", "🗂", "✦", "📝"];
            const i = icons.indexOf(note.icon);
            onChange({ icon: icons[(i + 1) % icons.length] });
          }}
        >
          {note.icon || "📄"}
        </button>

        <input
          className="note-editor__title"
          value={note.title}
          placeholder="无标题"
          onChange={(e) => onChange({ title: e.target.value })}
        />

        <textarea
          className="note-editor__body"
          value={note.content}
          placeholder="输入正文，或写下要点… 后续可让 AI 帮你整理、续写、提炼"
          onChange={(e) => onChange({ content: e.target.value })}
        />
      </div>
    </div>
  );
};
