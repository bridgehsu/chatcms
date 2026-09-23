/** 内容管理 · AI 笔记类型 */

export type AiNote = {
  id: string;
  title: string;
  content: string;
  icon: string;
  /** 所属分组；null/undefined = 未分组 */
  groupId?: string | null;
  /** 来自智能会话时记录溯源 */
  sourceSessionId?: string | null;
  sourceSessionTitle?: string | null;
  /** 来源助手消息 id（用于已保存标记 / 更新） */
  sourceMessageId?: string | null;
  /** 桥接知识库条目 id（Agent 可检索） */
  knowledgeId?: string | null;
  updatedAt: number;
  createdAt: number;
};

export type AiNoteGroup = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type AiNotesState = {
  notes: AiNote[];
  groups: AiNoteGroup[];
  activeId: string | null;
  /** 新建笔记默认写入的分组 */
  focusedGroupId: string | null;
};
