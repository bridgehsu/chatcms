import { useEffect, useId, useRef, useState } from "react";
import { IconMore, IconPencil, IconPin, IconPlus, IconTrash } from "@/components/icons";
import { invoke } from "@/hooks/useTauri";
import { useChatStore } from "@/stores/useChatStore";
import type { AgentProfile } from "@/types";
import { SessionDeleteDialog } from "./SessionDeleteDialog";

type PendingDelete = { id: string; title: string };

/**
 * 最近会话列表（含顶部 Agent Picker）
 */
export const SessionList = () => {
  const {
    sessions,
    activeSessionId,
    activeAgentId,
    setActiveAgent,
    loadSessions,
    selectSession,
    newSession,
    renameSession,
    deleteSession,
    pinSession,
  } = useChatStore();

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuFlipUp, setMenuFlipUp] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const menuLabelId = useId();

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    invoke<AgentProfile[]>("agent_list").then(setAgents).catch(console.error);
  }, []);

  useEffect(() => {
    if (!editingId) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingId]);

  useEffect(() => {
    if (!menuId) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      const trigger = (e.target as HTMLElement | null)?.closest?.(
        `[data-session-menu-trigger="${menuId}"]`
      );
      if (trigger) return;
      setMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuId]);

  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) setPendingDelete(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDelete, deleting]);

  const displayTitle = (raw: string) => raw.trim() || "新会话";

  const startRename = (id: string, title: string) => {
    setMenuId(null);
    setEditingId(id);
    setDraftTitle(displayTitle(title));
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraftTitle("");
  };

  const commitRename = async () => {
    if (!editingId) return;
    const id = editingId;
    const next = draftTitle.trim();
    const current = sessions.find((s) => s.id === id);
    setEditingId(null);
    setDraftTitle("");
    if (!next || !current || next === current.title) return;
    try {
      await renameSession(id, next);
    } catch (e) {
      console.error(e);
    }
  };

  const openMenu = (
    id: string,
    anchorEl: HTMLElement,
    mode: "toggle" | "open" = "toggle"
  ) => {
    if (editingId) return;
    const listEl = listRef.current;
    if (listEl) {
      const listRect = listEl.getBoundingClientRect();
      const rowRect = anchorEl.getBoundingClientRect();
      setMenuFlipUp(listRect.bottom - rowRect.bottom < 120);
    } else {
      setMenuFlipUp(false);
    }
    setMenuId((prev) => {
      if (mode === "toggle" && prev === id) return null;
      return id;
    });
  };

  const requestDelete = (id: string, title: string) => {
    setMenuId(null);
    setPendingDelete({ id, title: displayTitle(title) });
  };

  const togglePin = async (id: string, pinned: boolean) => {
    setMenuId(null);
    try {
      await pinSession(id, !pinned);
    } catch (e) {
      console.error(e);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSession(pendingDelete.id);
      if (editingId === pendingDelete.id) cancelRename();
      setPendingDelete(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const enabledAgents = agents.filter((a) => a.enabled);
  const activeAgent = enabledAgents.find((a) => a.id === activeAgentId) ?? null;

  return (
    <aside className="session-pane">
      {/* Agent Picker */}
      <div className="agent-picker">
        {enabledAgents.length === 0 ? (
          <div className="agent-picker__empty">暂无 Agent</div>
        ) : (
          <div className="agent-picker__list">
            <button
              type="button"
              className={`agent-picker__item${activeAgentId === null ? " is-active" : ""}`}
              onClick={() => setActiveAgent(null)}
            >
              <span className="agent-picker__emoji">💬</span>
              <span className="agent-picker__name">全部</span>
            </button>
            {enabledAgents.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`agent-picker__item${activeAgentId === a.id ? " is-active" : ""}`}
                onClick={() => setActiveAgent(a.id)}
                title={a.description || a.name}
              >
                <span className="agent-picker__emoji">{a.emoji || "🤖"}</span>
                <span className="agent-picker__name">{a.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Session Button */}
      <div className="session-pane-header">
        <button
          className="btn-new-session"
          onClick={newSession}
          type="button"
        >
          <span className="btn-new-session__icon">
            <IconPlus />
          </span>
          {activeAgent ? `${activeAgent.emoji || "🤖"} 新会话` : "发起新会话"}
        </button>
      </div>

      <div className="session-pane-label">
        {activeAgent ? activeAgent.name : "最近会话"}
      </div>

      <nav className="session-list" ref={listRef}>
        {sessions.length === 0 && (
          <p className="session-empty">
            暂无会话
            <span className="session-empty__hint">点击上方按钮开始</span>
          </p>
        )}

        {sessions.map((s) => {
          const title = displayTitle(s.title);
          const isEditing = editingId === s.id;
          const isActive = s.id === activeSessionId;
          const isMenuOpen = menuId === s.id;
          const isPinned = Boolean(s.pinned);

          return (
            <div
              key={s.id}
              className={[
                "session-item",
                isActive ? "is-active" : "",
                isEditing ? "is-editing" : "",
                isMenuOpen ? "is-menu-open" : "",
                isPinned ? "is-pinned" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onContextMenu={(e) => {
                if (isEditing) return;
                e.preventDefault();
                openMenu(s.id, e.currentTarget, "open");
              }}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  className="session-item__input"
                  value={draftTitle}
                  aria-label="编辑会话标题"
                  maxLength={80}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitRename();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      skipBlurRef.current = true;
                      cancelRename();
                    }
                  }}
                  onBlur={() => {
                    if (skipBlurRef.current) {
                      skipBlurRef.current = false;
                      return;
                    }
                    void commitRename();
                  }}
                />
              ) : (
                <>
                  <button
                    type="button"
                    className="session-item__main"
                    onClick={() => void selectSession(s.id)}
                  >
                    <span className="session-title">
                      {isPinned && (
                        <span className="session-title__pin" aria-label="已置顶" title="已置顶">
                          <IconPin filled />
                        </span>
                      )}
                      <span className="session-title__text">{title}</span>
                    </span>
                    <span className="session-meta">{s.message_count} 条消息</span>
                  </button>

                  <div className="session-item__toolbar">
                    <button
                      type="button"
                      className="session-item__more"
                      data-session-menu-trigger={s.id}
                      aria-label={`会话操作：${title}`}
                      aria-haspopup="menu"
                      aria-expanded={isMenuOpen}
                      title="更多"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMenu(s.id, e.currentTarget);
                      }}
                    >
                      <IconMore />
                    </button>

                    {isMenuOpen && (
                      <div
                        ref={menuRef}
                        className={`session-item__menu${menuFlipUp ? " is-up" : ""}`}
                        role="menu"
                        aria-labelledby={menuLabelId}
                      >
                        <span id={menuLabelId} className="sr-only">
                          会话操作
                        </span>
                        <button
                          type="button"
                          className="session-item__menu-item"
                          role="menuitem"
                          onClick={() => void togglePin(s.id, isPinned)}
                        >
                          <IconPin filled={isPinned} />
                          <span>{isPinned ? "取消置顶" : "置顶"}</span>
                        </button>
                        <button
                          type="button"
                          className="session-item__menu-item"
                          role="menuitem"
                          onClick={() => startRename(s.id, s.title)}
                        >
                          <IconPencil />
                          <span>重命名</span>
                        </button>
                        <div className="session-item__menu-sep" role="separator" />
                        <button
                          type="button"
                          className="session-item__menu-item is-danger"
                          role="menuitem"
                          onClick={() => requestDelete(s.id, s.title)}
                        >
                          <IconTrash />
                          <span>删除</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </nav>

      {pendingDelete && (
        <SessionDeleteDialog
          title={pendingDelete.title}
          busy={deleting}
          onCancel={() => {
            if (!deleting) setPendingDelete(null);
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      )}
    </aside>
  );
};
