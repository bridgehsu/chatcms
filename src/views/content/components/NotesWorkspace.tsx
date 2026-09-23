import { useEffect } from "react";
import { App as AntdApp, Spin } from "antd";
import { useAiNotes } from "../hooks/useAiNotes";
import { NoteEditor } from "./NoteEditor";
import { NotesSidebar } from "./NotesSidebar";

export const NotesWorkspace = () => {
  const { modal, message } = AntdApp.useApp();
  const {
    notes,
    groups,
    active,
    focusedGroupId,
    focusedGroupName,
    flashNoteId,
    ready,
    hydrate,
    select,
    clearFlash,
    setFocusedGroupId,
    create,
    update,
    remove,
    setNoteGroup,
    createGroup,
    renameGroup,
    deleteGroup,
  } = useAiNotes();

  useEffect(() => {
    void hydrate().catch((e) =>
      message.error(e instanceof Error ? e.message : String(e)),
    );
  }, [hydrate, message]);

  useEffect(() => {
    if (!flashNoteId) return;
    const t = window.setTimeout(() => clearFlash(), 1200);
    return () => window.clearTimeout(t);
  }, [flashNoteId, clearFlash]);

  const confirmRemove = (id: string) => {
    const note = notes.find((n) => n.id === id);
    const title = note?.title.trim() || "无标题";
    modal.confirm({
      title: "删除笔记？",
      content: `「${title}」删除后无法恢复。`,
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        await remove(id);
      },
    });
  };

  if (!ready) {
    return (
      <div className="notes-workspace notes-workspace--loading">
        <Spin tip="加载笔记…" />
      </div>
    );
  }

  return (
    <div className="notes-workspace">
      <NotesSidebar
        notes={notes}
        groups={groups}
        activeId={active?.id ?? null}
        flashNoteId={flashNoteId}
        focusedGroupId={focusedGroupId}
        onSelect={select}
        onCreate={() => void create()}
        onRemove={confirmRemove}
        onFocusGroup={setFocusedGroupId}
        onCreateGroup={(name) => createGroup(name)}
        onRenameGroup={(id, name) => renameGroup(id, name)}
        onDeleteGroup={(id) => deleteGroup(id)}
        onSetNoteGroup={(noteId, groupId) => setNoteGroup(noteId, groupId)}
      />
      <NoteEditor
        note={active}
        focusedGroupName={focusedGroupName}
        onChange={(patch) => {
          if (active) void update(active.id, patch);
        }}
        onCreate={(template) => void create({ template })}
      />
    </div>
  );
};
