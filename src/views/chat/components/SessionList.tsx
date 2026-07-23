import { useEffect } from "react";
import { IconPlus } from "@/components/icons";
import { useChatStore } from "@/stores/useChatStore";

/** 会话列表（仅智能会话页内） */
export const SessionList = () => {
  const { sessions, activeSessionId, loadSessions, selectSession, newSession } = useChatStore();

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return (
    <aside className="session-pane">
      <div className="session-pane-header">
        <button className="btn-new-session" onClick={newSession} type="button">
          <span className="btn-new-session__icon">
            <IconPlus />
          </span>
          发起新会话
        </button>
      </div>

      <div className="session-pane-label">最近会话</div>

      <nav className="session-list">
        {sessions.length === 0 && (
          <p className="session-empty">
            暂无会话
            <span className="session-empty__hint">点击上方按钮开始</span>
          </p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            className={`session-item ${s.id === activeSessionId ? "active" : ""}`}
            onClick={() => void selectSession(s.id)}
            type="button"
          >
            <span className="session-title">{s.title || "新会话"}</span>
            <span className="session-meta">{s.message_count} 条消息</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};
