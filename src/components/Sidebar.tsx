import { useEffect } from "react";
import { useChatStore } from "../store/chat";

export function Sidebar() {
  const { sessions, activeSessionId, loadSessions, selectSession, newSession } = useChatStore();

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">ChatCMS</span>
        <button className="btn-new" onClick={newSession} title="New chat">
          +
        </button>
      </div>

      <nav className="session-list">
        {sessions.length === 0 && (
          <p className="session-empty">No sessions yet</p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            className={`session-item ${s.id === activeSessionId ? "active" : ""}`}
            onClick={() => selectSession(s.id)}
          >
            <span className="session-title">{s.title}</span>
            <span className="session-meta">{s.message_count} msgs</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
