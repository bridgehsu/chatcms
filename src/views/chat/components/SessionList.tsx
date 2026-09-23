import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { App as AntdApp } from "antd";
import { IconChevron, IconMore, IconPencil, IconPin, IconPlus, IconTrash } from "@/components/icons";
import { useChatStore } from "@/stores/useChatStore";
import type { SessionGroup as PersistedGroup, SessionSummary } from "@/types";
import { SessionDeleteDialog } from "./SessionDeleteDialog";

type PendingDelete = { id: string; title: string };

type UiGroup = {
  id: string;
  label: string;
  items: SessionSummary[];
  /** 用户自定义分组才可改名/删除 */
  custom?: PersistedGroup;
};

const UNGROUPED_ID = "ungrouped";
const GROUPS_OPEN_KEY = "chatcms.session.groups.v2";
const PANE_WIDTH_KEY = "chatcms.session.pane.width";
const PANE_MIN = 220;
const PANE_MAX = 420;
const PANE_DEFAULT = 280;
const DND_MIME = "application/x-chatcms-session-id";

const toMs = (ts: number) => (ts > 1e12 ? ts : ts * 1000);

const formatRelativeTime = (ts: number) => {
  const ms = toMs(ts);
  const now = Date.now();
  const diff = Math.max(0, now - ms);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = startToday.getTime() - day;
  if (ms >= startYesterday && ms < startToday.getTime()) return "昨天";

  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;

  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayNum = String(d.getDate()).padStart(2, "0");
  return y === new Date().getFullYear() ? `${m}-${dayNum}` : `${y}-${m}-${dayNum}`;
};

const sortSessions = (items: SessionSummary[]) =>
  [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return toMs(b.updated) - toMs(a.updated);
  });

const buildUiGroups = (
  sessions: SessionSummary[],
  customGroups: PersistedGroup[],
  hideEmptyCustom = false,
): UiGroup[] => {
  let custom: UiGroup[] = customGroups.map((g) => ({
    id: `g:${g.id}`,
    label: g.name,
    items: sortSessions(sessions.filter((s) => s.group_id === g.id)),
    custom: g,
  }));
  if (hideEmptyCustom) {
    custom = custom.filter((g) => g.items.length > 0);
  }

  const ungrouped = sortSessions(sessions.filter((s) => !s.group_id));
  if (ungrouped.length > 0 || custom.length === 0) {
    custom.push({
      id: UNGROUPED_ID,
      label: "未分组",
      items: ungrouped,
    });
  }
  return custom;
};

const readOpen = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(GROUPS_OPEN_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
};

const readPaneWidth = () => {
  try {
    const n = Number(localStorage.getItem(PANE_WIDTH_KEY));
    if (Number.isFinite(n)) return Math.min(PANE_MAX, Math.max(PANE_MIN, n));
  } catch { /* ignore */ }
  return PANE_DEFAULT;
};

const IconFolder = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l1.8 1.8H19.5A1.5 1.5 0 0 1 21 9.3v8.2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-10Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 会话列表：顶栏操作 + 分组/未分组 + 拖拽进组 + 可拖宽
 */
export const SessionList = () => {
  const { message } = AntdApp.useApp();
  const {
    sessions,
    sessionGroups,
    focusedGroupId,
    activeSessionId,
    loadSessions,
    loadSessionGroups,
    selectSession,
    newSession,
    renameSession,
    deleteSession,
    pinSession,
    setSessionGroup,
    setFocusedGroupId,
    createSessionGroup,
    renameSessionGroup,
    deleteSessionGroup,
  } = useChatStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [groupMenuId, setGroupMenuId] = useState<string | null>(null);
  const [menuFlipUp, setMenuFlipUp] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(readOpen);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [draftGroupName, setDraftGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [paneWidth, setPaneWidth] = useState(readPaneWidth);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const groupInputRef = useRef<HTMLInputElement>(null);
  const newGroupInputRef = useRef<HTMLInputElement>(null);
  const skipBlurRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const resizeStartRef = useRef<{ x: number; w: number } | null>(null);
  const menuLabelId = useId();

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => (s.title || "").toLowerCase().includes(q));
  }, [sessions, query]);

  const groups = useMemo(
    () => buildUiGroups(filteredSessions, sessionGroups, Boolean(query.trim())),
    [filteredSessions, sessionGroups, query],
  );

  const focusedLabel = useMemo(() => {
    if (!focusedGroupId) return "未分组";
    return sessionGroups.find((g) => g.id === focusedGroupId)?.name ?? "未分组";
  }, [focusedGroupId, sessionGroups]);

  useEffect(() => {
    void loadSessions();
    void loadSessionGroups();
  }, [loadSessions, loadSessionGroups]);

  useEffect(() => {
    try {
      localStorage.setItem(GROUPS_OPEN_KEY, JSON.stringify(groupOpen));
    } catch { /* ignore */ }
  }, [groupOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(PANE_WIDTH_KEY, String(paneWidth));
    } catch { /* ignore */ }
  }, [paneWidth]);

  useEffect(() => {
    if (!editingId) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingId]);

  useEffect(() => {
    if (!editingGroupId) return;
    const t = window.setTimeout(() => {
      groupInputRef.current?.focus();
      groupInputRef.current?.select();
    }, 50);
    return () => window.clearTimeout(t);
  }, [editingGroupId]);

  useEffect(() => {
    if (!creatingGroup) return;
    newGroupInputRef.current?.focus();
    newGroupInputRef.current?.select();
  }, [creatingGroup]);

  useEffect(() => {
    if (!menuId && !groupMenuId) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (groupMenuRef.current?.contains(target)) return;
      const trigger = (e.target as HTMLElement | null)?.closest?.(
        `[data-session-menu-trigger],[data-group-menu-trigger]`,
      );
      if (trigger) return;
      setMenuId(null);
      setGroupMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuId(null);
        setGroupMenuId(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuId, groupMenuId]);

  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) setPendingDelete(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDelete, deleting]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const next = start.w + (e.clientX - start.x);
      setPaneWidth(Math.min(PANE_MAX, Math.max(PANE_MIN, next)));
    };
    const onUp = () => {
      if (!resizeStartRef.current) return;
      resizeStartRef.current = null;
      document.body.classList.remove("is-resizing-session-pane");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const isGroupOpen = (id: string) => groupOpen[id] !== false;

  const toggleGroup = (id: string) => {
    setGroupOpen((prev) => ({ ...prev, [id]: !(prev[id] !== false) }));
  };

  const focusGroup = (g: UiGroup) => {
    setFocusedGroupId(g.custom?.id ?? null);
  };

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
      message.error(typeof e === "string" ? e : (e as Error)?.message || String(e));
    }
  };

  const openMenu = (
    id: string,
    anchorEl: HTMLElement,
    mode: "toggle" | "open" = "toggle",
  ) => {
    if (editingId || editingGroupId) return;
    setGroupMenuId(null);
    const listEl = listRef.current;
    if (listEl) {
      const listRect = listEl.getBoundingClientRect();
      const rowRect = anchorEl.getBoundingClientRect();
      setMenuFlipUp(listRect.bottom - rowRect.bottom < 160);
    } else {
      setMenuFlipUp(false);
    }
    setMenuId((prev) => {
      if (mode === "toggle" && prev === id) return null;
      return id;
    });
  };

  const openGroupMenu = (id: string, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (editingId || editingGroupId) return;
    setMenuId(null);
    setGroupMenuId((prev) => (prev === id ? null : id));
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
      message.error(typeof e === "string" ? e : (e as Error)?.message || String(e));
    }
  };

  const moveToGroup = async (sessionId: string, groupId: string | null) => {
    setMenuId(null);
    try {
      await setSessionGroup(sessionId, groupId);
      message.success(groupId ? "已移动到分组" : "已移出分组");
    } catch (e) {
      message.error(typeof e === "string" ? e : (e as Error)?.message || String(e));
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
      message.error(typeof e === "string" ? e : (e as Error)?.message || String(e));
    } finally {
      setDeleting(false);
    }
  };

  const startCreateGroup = () => {
    setCreatingGroup(true);
    setNewGroupName("");
  };

  const cancelCreateGroup = () => {
    setCreatingGroup(false);
    setNewGroupName("");
  };

  const commitCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      cancelCreateGroup();
      return;
    }
    try {
      const g = await createSessionGroup(name);
      setGroupOpen((prev) => ({ ...prev, [`g:${g.id}`]: true }));
      setFocusedGroupId(g.id);
      cancelCreateGroup();
      message.success(`已创建分组「${g.name}」`);
    } catch (e) {
      message.error(typeof e === "string" ? e : (e as Error)?.message || String(e));
    }
  };

  const startRenameGroup = (g: PersistedGroup) => {
    setGroupMenuId(null);
    // 等菜单关闭后再进入编辑，避免立刻 blur 取消重命名
    window.setTimeout(() => {
      skipBlurRef.current = false;
      setEditingGroupId(g.id);
      setDraftGroupName(g.name);
    }, 0);
  };

  const cancelRenameGroup = () => {
    setEditingGroupId(null);
    setDraftGroupName("");
  };

  const commitRenameGroup = async () => {
    if (!editingGroupId) return;
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    const id = editingGroupId;
    const next = draftGroupName.trim();
    const current = sessionGroups.find((g) => g.id === id);
    setEditingGroupId(null);
    setDraftGroupName("");
    if (!next || !current || next === current.name) return;
    try {
      await renameSessionGroup(id, next);
    } catch (e) {
      message.error(typeof e === "string" ? e : (e as Error)?.message || String(e));
    }
  };

  const handleDeleteGroup = async (g: PersistedGroup) => {
    setGroupMenuId(null);
    try {
      await deleteSessionGroup(g.id);
      if (focusedGroupId === g.id) setFocusedGroupId(null);
      message.success(`已删除分组「${g.name}」`);
    } catch (e) {
      message.error(typeof e === "string" ? e : (e as Error)?.message || String(e));
    }
  };

  const onDragStartSession = (e: DragEvent, sessionId: string) => {
    e.dataTransfer.setData(DND_MIME, sessionId);
    e.dataTransfer.setData("text/plain", sessionId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingSessionId(sessionId);
    setMenuId(null);
  };

  const onDragEndSession = () => {
    setDraggingSessionId(null);
    setDropTargetId(null);
  };

  const onDragOverGroup = (e: DragEvent, uiGroupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetId(uiGroupId);
  };

  const onDropOnGroup = async (e: DragEvent, g: UiGroup) => {
    e.preventDefault();
    const sessionId =
      e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain");
    setDropTargetId(null);
    setDraggingSessionId(null);
    if (!sessionId) return;
    const targetId = g.custom?.id ?? null;
    const current = sessions.find((s) => s.id === sessionId);
    if (!current) return;
    if ((current.group_id ?? null) === targetId) return;
    try {
      await setSessionGroup(sessionId, targetId);
      message.success(targetId ? `已移入「${g.label}」` : "已移出分组");
    } catch (err) {
      message.error(typeof err === "string" ? err : (err as Error)?.message || String(err));
    }
  };

  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    resizeStartRef.current = { x: e.clientX, w: paneWidth };
    document.body.classList.add("is-resizing-session-pane");
  };

  const renderSession = (s: SessionSummary) => {
    const title = displayTitle(s.title);
    const isEditing = editingId === s.id;
    const isActive = s.id === activeSessionId;
    const isMenuOpen = menuId === s.id;
    const isPinned = Boolean(s.pinned);
    const isDragging = draggingSessionId === s.id;

    return (
      <div
        key={s.id}
        className={[
          "session-item",
          isActive ? "is-active" : "",
          isEditing ? "is-editing" : "",
          isMenuOpen ? "is-menu-open" : "",
          isPinned ? "is-pinned" : "",
          isDragging ? "is-dragging" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        draggable={!isEditing}
        onDragStart={(e) => onDragStartSession(e, s.id)}
        onDragEnd={onDragEndSession}
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
              title={`${title} · ${s.message_count} 条消息`}
            >
              <span className="session-title">
                {isPinned && (
                  <span className="session-title__pin" aria-label="已置顶" title="已置顶">
                    <IconPin filled />
                  </span>
                )}
                <span className="session-title__text">{title}</span>
              </span>
              <span className="session-meta">{formatRelativeTime(s.updated)}</span>
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

                  {sessionGroups.length > 0 && (
                    <>
                      <div className="session-item__menu-sep" role="separator" />
                      <div className="session-item__menu-label">移动到分组</div>
                      {s.group_id && (
                        <button
                          type="button"
                          className="session-item__menu-item"
                          role="menuitem"
                          onClick={() => void moveToGroup(s.id, null)}
                        >
                          <span>移出分组</span>
                        </button>
                      )}
                      {sessionGroups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          className={`session-item__menu-item${s.group_id === g.id ? " is-active" : ""}`}
                          role="menuitem"
                          disabled={s.group_id === g.id}
                          onClick={() => void moveToGroup(s.id, g.id)}
                        >
                          <span>{g.name}</span>
                        </button>
                      ))}
                    </>
                  )}

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
  };

  return (
    <aside className="session-pane" style={{ width: paneWidth, minWidth: paneWidth }}>
      <div className="session-pane-header">
        <div className="session-pane-actions">
          <button
            type="button"
            className="btn-new-session btn-new-session--compact"
            onClick={newSession}
            title={`新会话将创建在「${focusedLabel}」`}
          >
            <span className="btn-new-session__icon">
              <IconPlus />
            </span>
            新会话
          </button>
          <button
            type="button"
            className="session-pane-folder-btn"
            onClick={startCreateGroup}
            title="新建分组"
            aria-label="新建分组"
          >
            <IconFolder />
          </button>
        </div>
        <input
          className="session-pane-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索会话…"
          aria-label="搜索会话"
        />
        <p className="session-pane-focus-hint">
          新建到：<strong>{focusedLabel}</strong>
          <span className="session-pane-focus-hint__tip"> · 可拖拽会话进组</span>
        </p>
      </div>

      {creatingGroup && (
        <div className="session-group-create">
          <input
            ref={newGroupInputRef}
            className="session-item__input"
            value={newGroupName}
            maxLength={40}
            placeholder="分组名称，回车创建"
            aria-label="新建分组名称"
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitCreateGroup();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelCreateGroup();
              }
            }}
            onBlur={() => {
              void commitCreateGroup();
            }}
          />
        </div>
      )}

      <nav className="session-list" ref={listRef}>
        {filteredSessions.length === 0 && sessionGroups.length === 0 && !creatingGroup && (
          <p className="session-empty">
            {query.trim() ? "无匹配会话" : "暂无会话"}
            <span className="session-empty__hint">
              {query.trim() ? "试试其他关键词" : "点击上方「新会话」开始"}
            </span>
          </p>
        )}

        {groups.map((g) => {
          const open = isGroupOpen(g.id);
          const isCustom = Boolean(g.custom);
          const isRenaming = g.custom && editingGroupId === g.custom.id;
          const isGroupMenuOpen = g.custom && groupMenuId === g.custom.id;
          const isFocused =
            (g.custom?.id ?? null) === focusedGroupId ||
            (g.id === UNGROUPED_ID && focusedGroupId === null);
          const isDropTarget = dropTargetId === g.id;

          return (
            <div
              key={g.id}
              className={[
                "session-group",
                open ? "is-open" : "",
                isCustom ? "is-custom" : "",
                isFocused ? "is-focused" : "",
                isDropTarget ? "is-drop-target" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onDragOver={(e) => onDragOverGroup(e, g.id)}
              onDragLeave={() => {
                setDropTargetId((prev) => (prev === g.id ? null : prev));
              }}
              onDrop={(e) => void onDropOnGroup(e, g)}
            >
              <div className="session-group__header-row">
                {isRenaming ? (
                  <input
                    ref={groupInputRef}
                    className="session-item__input session-group__rename-input"
                    value={draftGroupName}
                    maxLength={40}
                    aria-label="编辑分组名称"
                    onChange={(e) => setDraftGroupName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void commitRenameGroup();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        skipBlurRef.current = true;
                        cancelRenameGroup();
                      }
                    }}
                    onBlur={() => {
                      if (skipBlurRef.current) {
                        skipBlurRef.current = false;
                        return;
                      }
                      void commitRenameGroup();
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="session-group__header"
                    aria-expanded={open}
                    onClick={() => {
                      focusGroup(g);
                      toggleGroup(g.id);
                    }}
                  >
                    <span className="session-group__chevron" aria-hidden>
                      <IconChevron open={open} />
                    </span>
                    <span className="session-group__label">{g.label}</span>
                    <span className="session-group__count">{g.items.length}</span>
                  </button>
                )}

                {isCustom && g.custom && !isRenaming && (
                  <div className="session-group__actions">
                    <button
                      type="button"
                      className="session-item__more"
                      data-group-menu-trigger={g.custom.id}
                      aria-label={`分组操作：${g.label}`}
                      aria-haspopup="menu"
                      aria-expanded={Boolean(isGroupMenuOpen)}
                      title="分组操作"
                      onClick={(e) => openGroupMenu(g.custom!.id, e)}
                    >
                      <IconMore />
                    </button>
                    {isGroupMenuOpen && (
                      <div
                        ref={groupMenuRef}
                        className="session-item__menu session-group__menu"
                        role="menu"
                      >
                        <button
                          type="button"
                          className="session-item__menu-item"
                          role="menuitem"
                          onClick={() => startRenameGroup(g.custom!)}
                        >
                          <IconPencil />
                          <span>重命名</span>
                        </button>
                        <div className="session-item__menu-sep" role="separator" />
                        <button
                          type="button"
                          className="session-item__menu-item is-danger"
                          role="menuitem"
                          onClick={() => void handleDeleteGroup(g.custom!)}
                        >
                          <IconTrash />
                          <span>删除分组</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {open ? (
                <div className="session-group__items" role="group" aria-label={g.label}>
                  {g.items.length === 0 ? (
                    <p className="session-group__empty">
                      {isCustom ? "拖入会话，或从菜单移入" : "暂无会话"}
                    </p>
                  ) : (
                    g.items.map(renderSession)
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div
        className="session-pane-resizer"
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="调整会话栏宽度"
        title="拖动调整宽度"
      />

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
