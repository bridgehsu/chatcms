import { create } from "zustand";
import { invoke } from "@/hooks/useTauri";
import type { AiNote, AiNoteGroup, AiNotesState } from "@/views/content/types";

export const NOTES_STORAGE_KEY = "chatcms.ai-notes.v2";
const LEGACY_KEY = "chatcms.ai-notes.v1";
export const NOTES_LAST_GROUP_KEY = "chatcms.notes.last-group.v1";
const UI_STATE_KEY = "chatcms.notes.ui.v1";

type BackendNote = {
  id: string;
  title: string;
  content: string;
  icon: string;
  groupId?: string | null;
  sourceSessionId?: string | null;
  sourceSessionTitle?: string | null;
  sourceMessageId?: string | null;
  knowledgeId?: string | null;
  createdAt: number;
  updatedAt: number;
};

type BackendGroup = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

type NotesBundle = { notes: BackendNote[]; groups: BackendGroup[] };

const mapNote = (n: BackendNote): AiNote => ({
  id: n.id,
  title: n.title ?? "",
  content: n.content ?? "",
  icon: n.icon || "📄",
  groupId: n.groupId ?? null,
  sourceSessionId: n.sourceSessionId ?? null,
  sourceSessionTitle: n.sourceSessionTitle ?? null,
  sourceMessageId: n.sourceMessageId ?? null,
  knowledgeId: n.knowledgeId ?? null,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

const mapGroup = (g: BackendGroup): AiNoteGroup => ({
  id: g.id,
  name: g.name,
  sortOrder: g.sortOrder,
  createdAt: g.createdAt,
  updatedAt: g.updatedAt,
});

const readUiState = (): Pick<AiNotesState, "activeId" | "focusedGroupId"> => {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (!raw) return { activeId: null, focusedGroupId: readLastGroupId() };
    const parsed = JSON.parse(raw) as Partial<AiNotesState>;
    return {
      activeId: parsed.activeId ?? null,
      focusedGroupId: parsed.focusedGroupId ?? readLastGroupId(),
    };
  } catch {
    return { activeId: null, focusedGroupId: readLastGroupId() };
  }
};

const writeUiState = (activeId: string | null, focusedGroupId: string | null) => {
  try {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify({ activeId, focusedGroupId }));
  } catch { /* ignore */ }
};

const readLegacyBundle = (): NotesBundle | null => {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiNotesState>;
    if (!parsed?.notes?.length) return null;
    return {
      notes: (parsed.notes ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        icon: n.icon || "📄",
        groupId: n.groupId ?? null,
        sourceSessionId: n.sourceSessionId ?? null,
        sourceSessionTitle: n.sourceSessionTitle ?? null,
        sourceMessageId: n.sourceMessageId ?? null,
        knowledgeId: null,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      groups: (parsed.groups ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        sortOrder: g.sortOrder,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
    };
  } catch {
    return null;
  }
};

export type NoteTemplate = {
  id: string;
  label: string;
  icon: string;
  title: string;
  content: string;
};

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "blank",
    label: "空白笔记",
    icon: "📄",
    title: "无标题",
    content: "",
  },
  {
    id: "meeting",
    label: "会议纪要",
    icon: "📝",
    title: "会议纪要",
    content:
      "## 基本信息\n- 时间：\n- 参与人：\n- 主题：\n\n## 讨论要点\n1. \n\n## 待办\n- [ ] \n\n## 结论\n",
  },
  {
    id: "idea",
    label: "灵感草稿",
    icon: "💡",
    title: "灵感",
    content: "## 想法\n\n## 为什么值得做\n\n## 下一步\n- \n",
  },
  {
    id: "brief",
    label: "内容大纲",
    icon: "🗂",
    title: "内容大纲",
    content: "## 标题候选\n\n## 受众\n\n## 结构\n1. 开头\n2. 主体\n3. 结尾 CTA\n\n## 素材\n- \n",
  },
];

export const readLastGroupId = (): string | null => {
  try {
    const v = localStorage.getItem(NOTES_LAST_GROUP_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
};

export const writeLastGroupId = (groupId: string | null) => {
  try {
    if (groupId) localStorage.setItem(NOTES_LAST_GROUP_KEY, groupId);
    else localStorage.removeItem(NOTES_LAST_GROUP_KEY);
  } catch { /* ignore */ }
};

type CreateOpts = {
  groupId?: string | null;
  template?: NoteTemplate;
  title?: string;
  content?: string;
  icon?: string;
  sourceSessionId?: string | null;
  sourceSessionTitle?: string | null;
  sourceMessageId?: string | null;
};

interface NotesStore extends AiNotesState {
  ready: boolean;
  flashNoteId: string | null;
  clearFlash: () => void;
  hydrate: () => Promise<void>;
  select: (id: string) => void;
  setFocusedGroupId: (groupId: string | null) => void;
  create: (opts?: CreateOpts) => Promise<AiNote>;
  update: (
    id: string,
    patch: Partial<
      Pick<
        AiNote,
        | "title"
        | "content"
        | "icon"
        | "groupId"
        | "sourceSessionId"
        | "sourceSessionTitle"
        | "sourceMessageId"
      >
    >,
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setNoteGroup: (noteId: string, groupId: string | null) => Promise<void>;
  createGroup: (name: string) => Promise<AiNoteGroup>;
  renameGroup: (groupId: string, name: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  reload: () => Promise<void>;
}

const applyBundle = (
  set: (p: Partial<NotesStore>) => void,
  get: () => NotesStore,
  bundle: NotesBundle,
) => {
  const notes = bundle.notes.map(mapNote);
  const groups = bundle.groups.map(mapGroup);
  const ui = readUiState();
  const activeId =
    (ui.activeId && notes.some((n) => n.id === ui.activeId) && ui.activeId) ||
    notes[0]?.id ||
    null;
  const focusedGroupId =
    ui.focusedGroupId && groups.some((g) => g.id === ui.focusedGroupId)
      ? ui.focusedGroupId
      : null;
  writeUiState(activeId, focusedGroupId);
  set({
    notes,
    groups,
    activeId,
    focusedGroupId,
    ready: true,
    flashNoteId: get().flashNoteId,
  });
};

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  groups: [],
  activeId: null,
  focusedGroupId: readLastGroupId(),
  ready: false,
  flashNoteId: null,

  clearFlash: () => set({ flashNoteId: null }),

  hydrate: async () => {
    let bundle = await invoke<NotesBundle>("notes_list");
    if (!bundle.notes.length) {
      const legacy = readLegacyBundle();
      if (legacy?.notes.length) {
        bundle = await invoke<NotesBundle>("notes_import_legacy", {
          notes: legacy.notes,
          groups: legacy.groups,
        });
        try {
          localStorage.removeItem(NOTES_STORAGE_KEY);
          localStorage.removeItem(LEGACY_KEY);
        } catch { /* ignore */ }
      }
    }
    applyBundle(set, get, bundle);
  },

  reload: async () => {
    const bundle = await invoke<NotesBundle>("notes_list");
    applyBundle(set, get, bundle);
  },

  select: (id) => {
    const s = get();
    const note = s.notes.find((n) => n.id === id);
    const focusedGroupId = note?.groupId ?? null;
    writeUiState(id, focusedGroupId);
    if (focusedGroupId) writeLastGroupId(focusedGroupId);
    set({ activeId: id, focusedGroupId, flashNoteId: id });
  },

  setFocusedGroupId: (groupId) => {
    writeLastGroupId(groupId);
    writeUiState(get().activeId, groupId);
    set({ focusedGroupId: groupId });
  },

  create: async (opts) => {
    const s = get();
    const tpl = opts?.template;
    const groupId =
      opts?.groupId !== undefined ? opts.groupId : s.focusedGroupId;
    const created = await invoke<BackendNote>("notes_create", {
      title: opts?.title ?? tpl?.title ?? "无标题",
      content: opts?.content ?? tpl?.content ?? "",
      icon: opts?.icon ?? tpl?.icon ?? "📄",
      groupId: groupId ?? null,
      sourceSessionId: opts?.sourceSessionId ?? null,
      sourceSessionTitle: opts?.sourceSessionTitle ?? null,
      sourceMessageId: opts?.sourceMessageId ?? null,
    });
    const note = mapNote(created);
    writeLastGroupId(groupId ?? null);
    writeUiState(note.id, groupId ?? null);
    set({
      notes: [note, ...s.notes.filter((n) => n.id !== note.id)],
      activeId: note.id,
      focusedGroupId: groupId ?? null,
    });
    return note;
  },

  update: async (id, patch) => {
    if (patch.groupId !== undefined) writeLastGroupId(patch.groupId);
    const payload: Record<string, unknown> = { id };
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.content !== undefined) payload.content = patch.content;
    if (patch.icon !== undefined) payload.icon = patch.icon;
    if (patch.groupId !== undefined) payload.groupId = patch.groupId ?? "";
    if (patch.sourceSessionId !== undefined)
      payload.sourceSessionId = patch.sourceSessionId ?? "";
    if (patch.sourceSessionTitle !== undefined)
      payload.sourceSessionTitle = patch.sourceSessionTitle ?? "";
    if (patch.sourceMessageId !== undefined)
      payload.sourceMessageId = patch.sourceMessageId ?? "";
    const updated = await invoke<BackendNote>("notes_update", payload);
    const note = mapNote(updated);
    set({
      notes: get().notes.map((n) => (n.id === id ? note : n)),
    });
  },

  remove: async (id) => {
    await invoke("notes_remove", { id });
    const s = get();
    const notes = s.notes.filter((n) => n.id !== id);
    const activeId = s.activeId === id ? (notes[0]?.id ?? null) : s.activeId;
    writeUiState(activeId, s.focusedGroupId);
    set({ notes, activeId });
  },

  setNoteGroup: async (noteId, groupId) => {
    writeLastGroupId(groupId);
    await get().update(noteId, { groupId });
  },

  createGroup: async (name) => {
    const created = await invoke<BackendGroup>("notes_group_create", { name });
    const g = mapGroup(created);
    writeLastGroupId(g.id);
    writeUiState(get().activeId, g.id);
    set({
      groups: [...get().groups, g],
      focusedGroupId: g.id,
    });
    return g;
  },

  renameGroup: async (groupId, name) => {
    const updated = await invoke<BackendGroup>("notes_group_rename", {
      id: groupId,
      name,
    });
    const g = mapGroup(updated);
    set({
      groups: get().groups.map((x) => (x.id === groupId ? g : x)),
    });
  },

  deleteGroup: async (groupId) => {
    await invoke("notes_group_delete", { id: groupId });
    const s = get();
    const focusedGroupId =
      s.focusedGroupId === groupId ? null : s.focusedGroupId;
    writeUiState(s.activeId, focusedGroupId);
    set({
      groups: s.groups.filter((g) => g.id !== groupId),
      focusedGroupId,
    });
  },
}));

export const useAiNotes = () => {
  const notes = useNotesStore((s) => s.notes);
  const groups = useNotesStore((s) => s.groups);
  const activeId = useNotesStore((s) => s.activeId);
  const focusedGroupId = useNotesStore((s) => s.focusedGroupId);
  const flashNoteId = useNotesStore((s) => s.flashNoteId);
  const ready = useNotesStore((s) => s.ready);
  const hydrate = useNotesStore((s) => s.hydrate);
  const select = useNotesStore((s) => s.select);
  const clearFlash = useNotesStore((s) => s.clearFlash);
  const setFocusedGroupId = useNotesStore((s) => s.setFocusedGroupId);
  const create = useNotesStore((s) => s.create);
  const update = useNotesStore((s) => s.update);
  const remove = useNotesStore((s) => s.remove);
  const setNoteGroup = useNotesStore((s) => s.setNoteGroup);
  const createGroup = useNotesStore((s) => s.createGroup);
  const renameGroup = useNotesStore((s) => s.renameGroup);
  const deleteGroup = useNotesStore((s) => s.deleteGroup);

  const active = notes.find((n) => n.id === activeId) ?? null;
  const focusedGroupName = !focusedGroupId
    ? "未分组"
    : groups.find((g) => g.id === focusedGroupId)?.name ?? "未分组";

  return {
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
  };
};
