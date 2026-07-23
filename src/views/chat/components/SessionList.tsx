import { useEffect } from "react";
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
        <span className="session-pane-title">会话</span>
        <button className="btn-new" onClick={newSession} title="新建会话" type="button">
          +
        </button>
      </div>

      <nav className="session-list">
        {sessions.length === 0 && <p className="session-empty">暂无会话</p>}
        {sessions.map((s) => (
          <button
            key={s.id}
            className={`session-item ${s.id === activeSessionId ? "active" : ""}`}
            onClick={() => void selectSession(s.id)}
            type="button"
          >
            <span className="session-title">{s.title}</span>
            <span className="session-meta">{s.message_count} 条消息</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};
