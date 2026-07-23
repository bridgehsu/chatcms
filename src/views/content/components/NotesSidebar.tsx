import { IconPlus } from "@/components/icons";
import type { AiNote } from "../types";

type Props = {
  notes: AiNote[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRemove: (id: string) => void;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  const h = `${d.getHours()}`.padStart(2, "0");
  const min = `${d.getMinutes()}`.padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
};

export const NotesSidebar = ({
  notes,
  activeId,
  onSelect,
  onCreate,
  onRemove,
}: Props) => (
  <aside className="notes-sidebar">
    <div className="notes-sidebar__head">
      <button className="btn-new-session" onClick={onCreate} type="button">
        <span className="btn-new-session__icon">
          <IconPlus />
        </span>
        新建笔记
      </button>
    </div>

    <div className="notes-sidebar__label">最近笔记</div>

    <div className="notes-sidebar__list">
      {notes.length === 0 ? (
        <p className="notes-sidebar__empty">
          暂无笔记
          <span className="notes-sidebar__empty-hint">点击上方按钮开始</span>
        </p>
      ) : (
        notes.map((n) => (
          <div
            key={n.id}
            className={`notes-sidebar__item${n.id === activeId ? " is-active" : ""}`}
            onClick={() => onSelect(n.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(n.id);
              }
            }}
          >
            <span className="notes-sidebar__icon" aria-hidden="true">
              {n.icon || "📄"}
            </span>
            <div className="notes-sidebar__meta">
              <div className="notes-sidebar__name">{n.title.trim() || "无标题"}</div>
              <div className="notes-sidebar__time">{formatTime(n.updatedAt)}</div>
            </div>
            <button
              type="button"
              className="notes-sidebar__delete"
              aria-label={`删除 ${n.title || "无标题"}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(n.id);
              }}
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  </aside>
);
