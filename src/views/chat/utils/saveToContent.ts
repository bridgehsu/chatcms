import { invoke } from "@/hooks/useTauri";
import {
  readLastGroupId,
  useNotesStore,
  writeLastGroupId,
} from "@/stores/useNotesStore";
import type { AiNote } from "@/views/content/types";

export type SaveForm = "summary" | "transcript";

export const buildSourceFooter = (
  sessionTitle: string,
  sessionId: string,
): string => {
  const date = new Date();
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `\n\n---\n来源：会话「${sessionTitle || "未命名"}」· ${y}-${m}-${d}（${sessionId.slice(0, 8)}）`;
};

/** 单条助手回复 → 笔记整理 */
export const REPLY_SUMMARY_SYSTEM = `你是内容整理助手。请将用户提供的「助手回复」整理成一篇可直接保存的笔记。
要求：
1. 使用简洁中文 Markdown
2. 先给一行标题建议（用 # 标题）
3. 保留关键信息与结构，可适度精炼，不要编造原文没有的信息
4. 不要输出开场白或结束语`;

export const guessTitleFromContent = (content: string, fallback: string): string => {
  const line =
    content
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  const cleaned = line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*•]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
  if (!cleaned) return fallback || "助手回复";
  return cleaned.length > 40 ? `${cleaned.slice(0, 40)}…` : cleaned;
};

export const parseTitleFromSummary = (
  text: string,
  fallback: string,
): { title: string; body: string } => {
  const lines = text.trim().split("\n");
  const first = lines[0]?.trim() ?? "";
  if (first.startsWith("# ")) {
    const title = first.replace(/^#\s+/, "").trim() || fallback;
    const body = lines.slice(1).join("\n").replace(/^\n+/, "");
    return { title, body };
  }
  return { title: fallback || "助手回复", body: text.trim() };
};

export type SaveReplyOpts = {
  content: string;
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  form?: SaveForm;
  title?: string;
  groupId?: string | null;
  noteId?: string | null;
  /** 用于取消过期的 AI 整理结果 */
  signal?: AbortSignal;
};

/** 将助手回复写入内容管理（原文或 AI 整理） */
export const saveAssistantReply = async (opts: SaveReplyOpts): Promise<AiNote> => {
  const rawContent = opts.content.trim();
  if (!rawContent) throw new Error("这条回复没有可保存的内容");

  const form = opts.form ?? "transcript";
  const fallbackTitle = guessTitleFromContent(
    rawContent,
    opts.sessionTitle.trim() || "助手回复",
  );
  let noteTitle = (opts.title ?? fallbackTitle).trim() || "助手回复";
  const footer = buildSourceFooter(opts.sessionTitle, opts.sessionId);
  let body: string;

  if (form === "transcript") {
    body = rawContent + footer;
  } else {
    if (opts.signal?.aborted) throw new Error("已取消");
    const raw = await invoke<string>("chat_complete", {
      content: `会话：${opts.sessionTitle || "未命名"}\n\n助手回复：\n\n${rawContent}`,
      systemPrompt: REPLY_SUMMARY_SYSTEM,
    });
    if (opts.signal?.aborted) throw new Error("已取消");
    const parsed = parseTitleFromSummary(raw, noteTitle);
    if (!opts.title?.trim()) noteTitle = parsed.title;
    body = parsed.body + footer;
  }

  const store = useNotesStore.getState();
  if (!store.ready) await store.hydrate();

  const gid =
    opts.groupId !== undefined
      ? opts.groupId
      : (() => {
          const last = readLastGroupId();
          const groups = useNotesStore.getState().groups;
          return last && groups.some((g) => g.id === last) ? last : null;
        })();

  writeLastGroupId(gid);

  if (opts.noteId) {
    await useNotesStore.getState().update(opts.noteId, {
      title: noteTitle,
      content: body,
      icon: form === "summary" ? "✨" : "📄",
      groupId: gid,
      sourceSessionId: opts.sessionId,
      sourceSessionTitle: opts.sessionTitle || null,
      sourceMessageId: opts.messageId,
    });
    const updated = useNotesStore.getState().notes.find((n) => n.id === opts.noteId);
    if (!updated) throw new Error("笔记不存在");
    return updated;
  }

  return useNotesStore.getState().create({
    title: noteTitle,
    content: body,
    icon: form === "summary" ? "✨" : "📄",
    groupId: gid,
    sourceSessionId: opts.sessionId,
    sourceSessionTitle: opts.sessionTitle || null,
    sourceMessageId: opts.messageId,
  });
};

/** 同一消息可能有多篇；取最近更新的一篇作为「主笔记」 */
export const findLatestNoteByMessageId = (messageId: string): AiNote | undefined => {
  const list = useNotesStore
    .getState()
    .notes.filter((n) => n.sourceMessageId === messageId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return list[0];
};

export const listNotesByMessageId = (messageId: string): AiNote[] =>
  useNotesStore
    .getState()
    .notes.filter((n) => n.sourceMessageId === messageId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

/** @deprecated 使用 findLatestNoteByMessageId */
export const findNoteByMessageId = findLatestNoteByMessageId;

export const AI_EDIT_ACTIONS = [
  {
    id: "shorten",
    label: "精简",
    system:
      "将用户给出的文稿精简，保留关键信息与结构。只输出改写后的 Markdown 正文，不要解释。",
  },
  {
    id: "expand",
    label: "扩写",
    system:
      "在保持原意的前提下扩写用户文稿，补充必要说明与细节。只输出改写后的 Markdown 正文，不要解释。",
  },
  {
    id: "polish",
    label: "润色",
    system:
      "润色用户文稿：更通顺、专业，不改变事实。只输出改写后的 Markdown 正文，不要解释。",
  },
  {
    id: "outline",
    label: "转大纲",
    system:
      "把用户文稿整理成清晰的 Markdown 大纲（标题 + 要点列表）。只输出大纲，不要解释。",
  },
] as const;
