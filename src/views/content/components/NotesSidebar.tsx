import { useEffect, useMemo, useRef, useState } from "react";
import {
  DeleteOutlined,
  EditOutlined,
  FolderAddOutlined,
  MoreOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { App as AntdApp, Button, Dropdown, Empty, Input, Tooltip, Typography } from "antd";
import type { InputRef } from "antd";
import { IconChevron } from "@/components/icons";
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
  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
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
  const newGroupRef = useRef<InputRef>(null);
  const renameGroupRef = useRef<InputRef>(null);
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

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(groupOpen));
    } catch { /* ignore */ }
  }, [groupOpen]);

  useEffect(() => {
    if (creatingGroup) newGroupRef.current?.focus();
  }, [creatingGroup]);

  useEffect(() => {
    if (!editingGroupId) {
      renameReadyRef.current = false;
      return;
    }
    renameReadyRef.current = false;
    const t = window.setTimeout(() => {
      renameGroupRef.current?.focus({ cursor: "all" });
      renameReadyRef.current = true;
    }, 50);
    return () => window.clearTimeout(t);
  }, [editingGroupId]);

  const startRenameGroup = (g: AiNoteGroup) => {
    // 等 Dropdown 关闭后再进入编辑，避免立刻 blur 取消重命名
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

  const commitCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      setCreatingGroup(false);
      setNewGroupName("");
      return;
    }
    try {
      const g = await onCreateGroup(name);
      setGroupOpen((prev) => ({ ...prev, [`g:${g.id}`]: true }));
      setCreatingGroup(false);
      setNewGroupName("");
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
        <div className="notes-sidebar__brand">
          <Typography.Text className="notes-sidebar__brand-title">笔记</Typography.Text>
          <div className="notes-sidebar__brand-actions">
            <Tooltip title="新建分组">
              <Button
                type="text"
                size="small"
                icon={<FolderAddOutlined />}
                aria-label="新建分组"
                onClick={() => {
                  setCreatingGroup(true);
                  setNewGroupName("");
                }}
              />
            </Tooltip>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onCreate}>
              新笔记
            </Button>
          </div>
        </div>
        <Input
          allowClear
          size="small"
          prefix={<SearchOutlined style={{ color: "var(--text-dim)" }} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索"
          className="notes-sidebar__search-input"
          aria-label="搜索笔记"
        />
      </div>

      {creatingGroup && (
        <div className="notes-sidebar__create-group">
          <Input
            ref={newGroupRef}
            size="small"
            value={newGroupName}
            maxLength={40}
            placeholder="分组名称，回车创建"
            onChange={(e) => setNewGroupName(e.target.value)}
            onPressEnter={commitCreateGroup}
            onBlur={commitCreateGroup}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setCreatingGroup(false);
                setNewGroupName("");
              }
            }}
          />
        </div>
      )}

      <div className="notes-sidebar__list">
        {filtered.length === 0 && groups.length === 0 && !creatingGroup ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={query.trim() ? "无匹配笔记" : "还没有笔记"}
            style={{ marginTop: 40 }}
          />
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
              className={`notes-group${open ? " is-open" : ""}${pinned ? " is-focused" : ""}`}
            >
              <div className="notes-group__header-row">
                {renaming ? (
                  <Input
                    ref={renameGroupRef}
                    size="small"
                    value={draftGroupName}
                    maxLength={40}
                    aria-label="编辑分组名称"
                    onChange={(e) => setDraftGroupName(e.target.value)}
                    onPressEnter={() => void commitRenameGroup()}
                    onBlur={() => void commitRenameGroup()}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRenameGroup();
                      }
                    }}
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
                          onClick: () => handleDeleteGroup(g.custom!),
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
                    <Typography.Text type="secondary" className="notes-group__empty">
                      暂无笔记
                    </Typography.Text>
                  ) : (
                    g.items.map((n) => (
                      <div
                        key={n.id}
                        className={`notes-sidebar__item${n.id === activeId ? " is-active" : ""}${
                          n.id === flashNoteId ? " is-flash" : ""
                        }`}
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
                          <div className="notes-sidebar__name">
                            {n.title.trim() || "无标题"}
                          </div>
                          <div className="notes-sidebar__time">{formatRelative(n.updatedAt)}</div>
                        </div>
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
      </div>
    </aside>
  );
};
