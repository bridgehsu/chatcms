import { useCallback, useEffect, useState } from "react";
import type { AiNote, AiNotesState } from "../types";

const STORAGE_KEY = "chatcms.ai-notes.v1";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createNote = (partial?: Partial<AiNote>): AiNote => {
  const now = Date.now();
  return {
    id: newId(),
    title: "",
    content: "",
    icon: "✦",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
};

const seed = (): AiNotesState => {
  const welcome = createNote({
    title: "欢迎使用 AI 笔记",
    icon: "✨",
    content:
      "这是一块类似 Notion 的写作空间。\n\n- 左侧管理笔记列表\n- 右侧编辑标题与正文\n- 后续可接入 Agent，一键整理、续写、提炼要点\n\n先写下一句话，开始你的知识库。",
  });
  return { notes: [welcome], activeId: welcome.id };
};

const load = (): AiNotesState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as AiNotesState;
    if (!parsed?.notes?.length) return seed();
    return {
      notes: parsed.notes,
      activeId: parsed.activeId ?? parsed.notes[0]?.id ?? null,
    };
  } catch {
    return seed();
  }
};

export const useAiNotes = () => {
  const [state, setState] = useState<AiNotesState>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const active = state.notes.find((n) => n.id === state.activeId) ?? null;

  const select = useCallback((id: string) => {
    setState((s) => ({ ...s, activeId: id }));
  }, []);

  const create = useCallback(() => {
    const note = createNote({ title: "无标题", icon: "📄" });
    setState((s) => ({
      notes: [note, ...s.notes],
      activeId: note.id,
    }));
    return note.id;
  }, []);

  const update = useCallback((id: string, patch: Partial<Pick<AiNote, "title" | "content" | "icon">>) => {
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    }));
  }, []);

  const remove = useCallback((id: string) => {
    setState((s) => {
      const notes = s.notes.filter((n) => n.id !== id);
      const activeId =
        s.activeId === id ? (notes[0]?.id ?? null) : s.activeId;
      return { notes, activeId };
    });
  }, []);

  return { notes: state.notes, active, select, create, update, remove };
};
