import { useEffect, useMemo, useRef, useState } from "react";
import {
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PushpinFilled,
  PushpinOutlined,
} from "@ant-design/icons";
import { App as AntdApp, Button, Dropdown, Tooltip } from "antd";
import { IconChevron, IconPlus } from "@/components/icons";
import type { AiNote, AiNoteGroup } from "../types";

type Props = {
  notes: AiNote[];
  groups: AiNoteGroup[];
  activeId: string | null;
  flashNoteId: string | null;
  focusedGroupId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRemove: (id: string) => void;
  onFocusGroup: (groupId: string | null) => void;
  onCreateGroup: (name: string) => AiNoteGroup | Promise<AiNoteGroup>;
  onRenameGroup: (groupId: string, name: string) => void | Promise<void>;
  onDeleteGroup: (groupId: string) => void | Promise<void>;
  onSetNoteGroup: (noteId: string, groupId: string | null) => void | Promise<void>;
};

type UiGroup = {
  id: string;
  label: string;
  items: AiNote[];
  custom?: AiNoteGroup;
};

const UNGROUPED = "ungrouped";
const OPEN_KEY = "chatcms.notes.groups.open.v1";

const formatRelative = (ts: number) => {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} 天前`;
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${m}-${dd}`;
};

const sortNotes = (items: AiNote[]) =>
  [...items].sort((a, b) => b.updatedAt - a.updatedAt);

const buildGroups = (notes: AiNote[], groups: AiNoteGroup[]): UiGroup[] => {
  const sortedGroups = [...groups].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt,
  );
  const custom: UiGroup[] = sortedGroups.map((g) => ({
    id: `g:${g.id}`,
    label: g.name,
    items: sortNotes(notes.filter((n) => n.groupId === g.id)),
    custom: g,
  }));
  const ungrouped = sortNotes(notes.filter((n) => !n.groupId));
  custom.push({ id: UNGROUPED, label: "未分组", items: ungrouped });
  return custom;
};

const readOpen = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
};

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M16.5 16.5L20 20"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

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

/** 内容管理 · 左侧笔记栏（布局对齐智能会话 session-pane） */
export const NotesSidebar = ({
  notes,
  groups,
  activeId,
  flashNoteId,
  focusedGroupId,
  onSelect,
  onCreate,
  onRemove,
  onFocusGroup,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onSetNoteGroup,
}: Props) => {
  const { message } = AntdApp.useApp();
  const [query, setQuery] = useState("");
  const [groupOpen, setGroupOpen] = useState(readOpen);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [draftGroupName, setDraftGroupName] = useState("");
  const newGroupRef = useRef<HTMLInputElement>(null);
  const renameGroupRef = useRef<HTMLInputElement>(null);
  const skipRenameBlurRef = useRef(false);
  const renameReadyRef = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q),
    );
  }, [notes, query]);

  const uiGroups = useMemo(
    () => buildGroups(filtered, groups),
    [filtered, groups],
  );

  const focusedLabel = useMemo(() => {
    if (!focusedGroupId) return "未分组";
    return groups.find((g) => g.id === focusedGroupId)?.name ?? "未分组";
  }, [focusedGroupId, groups]);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(groupOpen));
    } catch { /* ignore */ }
  }, [groupOpen]);

  useEffect(() => {
    if (!creatingGroup) return;
    const t = window.setTimeout(() => newGroupRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [creatingGroup]);

  useEffect(() => {
    if (!editingGroupId) {
      renameReadyRef.current = false;
      return;
    }
    renameReadyRef.current = false;
    const t = window.setTimeout(() => {
      renameGroupRef.current?.focus();
      renameGroupRef.current?.select();
      renameReadyRef.current = true;
    }, 50);
    return () => window.clearTimeout(t);
  }, [editingGroupId]);

  const startRenameGroup = (g: AiNoteGroup) => {
    window.setTimeout(() => {
      skipRenameBlurRef.current = false;
      setEditingGroupId(g.id);
      setDraftGroupName(g.name);
    }, 0);
  };

  const cancelRenameGroup = () => {
    skipRenameBlurRef.current = true;
    setEditingGroupId(null);
    setDraftGroupName("");
    renameReadyRef.current = false;
  };

  const isOpen = (id: string) => groupOpen[id] !== false;
  const toggle = (id: string) =>
    setGroupOpen((prev) => ({ ...prev, [id]: !(prev[id] !== false) }));

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
      const g = await onCreateGroup(name);
      setGroupOpen((prev) => ({ ...prev, [`g:${g.id}`]: true }));
      cancelCreateGroup();
      message.success(`已创建分组「${g.name}」`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    }
  };

  const commitRenameGroup = async () => {
    if (!editingGroupId) return;
    if (skipRenameBlurRef.current) {
      skipRenameBlurRef.current = false;
      return;
    }
    if (!renameReadyRef.current) return;
    const id = editingGroupId;
    const name = draftGroupName.trim();
    const cur = groups.find((g) => g.id === id);
    setEditingGroupId(null);
    setDraftGroupName("");
    renameReadyRef.current = false;
    if (!name || !cur || name === cur.name) return;
    try {
      await onRenameGroup(id, name);
      message.success("已重命名");
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeleteGroup = async (g: AiNoteGroup) => {
    try {
      await onDeleteGroup(g.id);
      message.success(`已删除分组「${g.name}」`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <aside className="notes-sidebar">
      <div className="notes-sidebar__head">
        <label className="notes-sidebar__search-wrap">
          <span className="notes-sidebar__search-icon" aria-hidden>
            <SearchIcon />
          </span>
          <input
            className="notes-sidebar__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索笔记…"
            aria-label="搜索笔记"
          />
        </label>
      </div>

      <nav className="notes-sidebar__list">
        {filtered.length === 0 && groups.length === 0 && !creatingGroup ? (
          <p className="notes-sidebar__empty">
            {query.trim() ? "无匹配笔记" : "暂无笔记"}
            <span className="notes-sidebar__empty-hint">
              {query.trim() ? "试试其他关键词" : "点击下方「新笔记」开始"}
            </span>
          </p>
        ) : null}

        {uiGroups.map((g) => {
          const open = isOpen(g.id);
          const pinned =
            (g.custom?.id ?? null) === focusedGroupId ||
            (g.id === UNGROUPED && focusedGroupId === null);
          const renaming = g.custom && editingGroupId === g.custom.id;
          const pinTarget = g.custom?.id ?? null;

          return (
            <div
              key={g.id}
              className={[
                "notes-group",
                open ? "is-open" : "",
                pinned ? "is-focused" : "",
                g.custom ? "is-custom" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="notes-group__header-row">
                {renaming ? (
                  <input
                    ref={renameGroupRef}
                    className="notes-sidebar__inline-input notes-group__rename-input"
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
                        cancelRenameGroup();
                      }
                    }}
                    onBlur={() => void commitRenameGroup()}
                  />
                ) : (
                  <button
                    type="button"
                    className="notes-group__header"
                    onClick={() => toggle(g.id)}
                    onDoubleClick={(e) => {
                      if (!g.custom) return;
                      e.preventDefault();
                      e.stopPropagation();
                      startRenameGroup(g.custom);
                    }}
                    title="展开 / 折叠 · 双击重命名"
                  >
                    <span className="notes-group__chevron" aria-hidden>
                      <IconChevron open={open} />
                    </span>
                    <span className="notes-group__label">{g.label}</span>
                    <span className="notes-group__count">{g.items.length}</span>
                  </button>
                )}

                {!renaming && (
                  <Tooltip title={pinned ? "当前新建目标" : "设为新建目标"}>
                    <Button
                      type="text"
                      size="small"
                      className={`notes-sidebar__pin${pinned ? " is-on" : ""}`}
                      icon={pinned ? <PushpinFilled /> : <PushpinOutlined />}
                      aria-label={pinned ? "当前新建目标" : "设为新建目标"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onFocusGroup(pinTarget);
                      }}
                    />
                  </Tooltip>
                )}

                {g.custom && !renaming && (
                  <Dropdown
                    trigger={["click"]}
                    menu={{
                      items: [
                        {
                          key: "rename",
                          icon: <EditOutlined />,
                          label: "重命名",
                          onClick: () => startRenameGroup(g.custom!),
                        },
                        {
                          key: "delete",
                          icon: <DeleteOutlined />,
                          label: "删除分组",
                          danger: true,
                          onClick: () => void handleDeleteGroup(g.custom!),
                        },
                      ],
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      className="notes-sidebar__more"
                      icon={<MoreOutlined />}
                      aria-label={`分组操作：${g.label}`}
                    />
                  </Dropdown>
                )}
              </div>

              {open && (
                <div className="notes-group__items">
                  {g.items.length === 0 ? (
                    <p className="notes-group__empty">暂无笔记</p>
                  ) : (
                    g.items.map((n) => (
                      <div
                        key={n.id}
                        className={[
                          "notes-sidebar__item",
                          n.id === activeId ? "is-active" : "",
                          n.id === flashNoteId ? "is-flash" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <button
                          type="button"
                          className="notes-sidebar__item-main"
                          onClick={() => onSelect(n.id)}
                        >
                          <span className="notes-sidebar__icon" aria-hidden="true">
                            {n.icon || "📄"}
                          </span>
                          <span className="notes-sidebar__meta">
                            <span className="notes-sidebar__name">
                              {n.title.trim() || "无标题"}
                            </span>
                            <span className="notes-sidebar__time">
                              {formatRelative(n.updatedAt)}
                            </span>
                          </span>
                        </button>
                        <Dropdown
                          trigger={["click"]}
                          menu={{
                            items: [
                              ...(groups.length > 0
                                ? [
                                    {
                                      type: "group" as const,
                                      label: "移动到分组",
                                      children: [
                                        ...(n.groupId
                                          ? [
                                              {
                                                key: "ungroup",
                                                label: "移出分组",
                                                onClick: () => {
                                                  onSetNoteGroup(n.id, null);
                                                  message.success("已移出分组");
                                                },
                                              },
                                            ]
                                          : []),
                                        ...groups.map((gg) => ({
                                          key: gg.id,
                                          label: gg.name,
                                          disabled: n.groupId === gg.id,
                                          onClick: () => {
                                            onSetNoteGroup(n.id, gg.id);
                                            message.success(`已移入「${gg.name}」`);
                                          },
                                        })),
                                      ],
                                    },
                                    { type: "divider" as const },
                                  ]
                                : []),
                              {
                                key: "delete",
                                icon: <DeleteOutlined />,
                                label: "删除",
                                danger: true,
                                onClick: () => onRemove(n.id),
                              },
                            ],
                          }}
                        >
                          <Button
                            type="text"
                            size="small"
                            className="notes-sidebar__more"
                            icon={<MoreOutlined />}
                            aria-label="笔记操作"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Dropdown>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {creatingGroup && (
        <div className="notes-sidebar__create-group notes-sidebar__create-group--footer">
          <input
            ref={newGroupRef}
            className="notes-sidebar__inline-input"
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
            onBlur={() => void commitCreateGroup()}
          />
        </div>
      )}

      <div className="notes-sidebar__footer">
        <p className="notes-sidebar__focus-hint">
          新建到 <strong>{focusedLabel}</strong>
        </p>
        <div className="notes-sidebar__footer-actions">
          <button
            type="button"
            className="btn-new-note"
            onClick={onCreate}
            title={`新笔记将创建在「${focusedLabel}」`}
          >
            <span className="btn-new-note__icon">
              <IconPlus />
            </span>
            新笔记
          </button>
          <button
            type="button"
            className="notes-sidebar__folder-btn"
            onClick={startCreateGroup}
            title="新建分组"
            aria-label="新建分组"
          >
            <IconFolder />
          </button>
        </div>
      </div>
    </aside>
  );
};
