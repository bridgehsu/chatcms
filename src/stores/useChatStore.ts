import { create } from "zustand";
import { invoke, listen } from "@/hooks/useTauri";
import type {
  ChatMode,
  Message,
  PermissionRequest,
  RememberScope,
  Session,
  SessionGroup,
  SessionSummary,
  StreamChunk,
  SubAgentDone,
  SubAgentStart,
  ThinkingChunk,
  TokenUsageEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "@/types";

const CHAT_MODE_KEY = "chatcms.chat.mode.v1";
const PREFERRED_AGENT_KEY = "chatcms.preferredAgentId";

const readChatMode = (): ChatMode => {
  try {
    const v = localStorage.getItem(CHAT_MODE_KEY);
    if (v === "ask" || v === "agent" || v === "search") return v;
    // 旧版 auto → Ask
  } catch { /* ignore */ }
  return "ask";
};

const readPreferredAgentId = (): string | null => {
  try {
    return localStorage.getItem(PREFERRED_AGENT_KEY);
  } catch {
    return null;
  }
};

interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

interface ChatState {
  sessions: SessionSummary[];
  sessionGroups: SessionGroup[];
  /** 当前聚焦的分组：新会话会写入该 group_id；null = 未分组 */
  focusedGroupId: string | null;
  activeSessionId: string | null;
  activeSession: Session | null;
  chatMode: ChatMode;
  /** 新建会话时的首选 Agent；null = 自动选角 */
  preferredAgentId: string | null;
  streamingContent: string;
  isStreaming: boolean;
  thinkingContent: string;
  isThinking: boolean;
  pendingPermission: PermissionRequest | null;
  error: string | null;
  tokenUsage: TokenUsage | null;

  setChatMode: (mode: ChatMode) => void;
  setPreferredAgentId: (agentId: string | null) => void;
  /** 已有会话切换主 Agent（落库 + 同步 workspace） */
  setSessionAgent: (agentId: string) => Promise<void>;
  setFocusedGroupId: (groupId: string | null) => void;
  loadSessions: () => Promise<void>;
  loadSessionGroups: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  abortSession: () => void;
  newSession: () => void;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  pinSession: (id: string, pinned: boolean) => Promise<void>;
  setSessionGroup: (sessionId: string, groupId: string | null) => Promise<void>;
  createSessionGroup: (name: string) => Promise<SessionGroup>;
  renameSessionGroup: (groupId: string, name: string) => Promise<void>;
  deleteSessionGroup: (groupId: string) => Promise<void>;
  clearError: () => void;
  respondPermission: (
    requestId: string,
    allowed: boolean,
    remember?: RememberScope,
  ) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => {
  // ── stream-chunk ─────────────────────────────────────────────────────────
  listen<StreamChunk>("stream-chunk", (event) => {
    const { session_id, delta, done } = event.payload;
    const { activeSessionId } = get();

    // 新会话时 activeSessionId 仍为 null，需放行首包流式事件
    if (session_id !== activeSessionId && activeSessionId !== null) return;

    if (done) {
      const sid = session_id;
      invoke<Session>("session_get", { sessionId: sid }).then((session) => {
        if (session) {
          set({
            activeSession: session,
            streamingContent: "",
            isStreaming: false,
            activeSessionId: sid,
            error: null,
          });
        } else {
          set({ isStreaming: false, streamingContent: "" });
        }
      });
      get().loadSessions();
    } else {
      set((s) => ({
        streamingContent: s.streamingContent + delta,
        isStreaming: true,
        // 收到首包时就把真实 session id 对齐，避免后续事件被过滤
        activeSessionId: s.activeSessionId ?? session_id,
      }));
    }
  });

  // ── thinking-chunk ───────────────────────────────────────────────────────
  listen<ThinkingChunk>("thinking-chunk", (event) => {
    const { session_id, delta, done } = event.payload;
    const { activeSessionId } = get();
    if (session_id !== activeSessionId && activeSessionId !== null) return;

    if (done) {
      set({ isThinking: false });
    } else {
      set((s) => ({
        thinkingContent: s.thinkingContent + delta,
        isThinking: true,
      }));
    }
  });

  // ── tool-call ────────────────────────────────────────────────────────────
  listen<ToolCallEvent>("tool-call", (event) => {
    const { session_id, id, name, input } = event.payload;
    const { activeSessionId } = get();
    if (session_id !== activeSessionId && activeSessionId !== null) return;

    const display = `[calling: ${name}]\n${JSON.stringify(input)}`;
    const msg: Message = {
      id: `tool-call-${id}`,
      role: "tool",
      content: display,
      created: Date.now(),
    };
    set((s) => {
      const session = s.activeSession
        ? { ...s.activeSession, messages: [...s.activeSession.messages, msg] }
        : null;
      return { activeSession: session };
    });
  });

  // ── tool-result ──────────────────────────────────────────────────────────
  listen<ToolResultEvent>("tool-result", (event) => {
    const { session_id, id, content, is_error } = event.payload;
    const { activeSessionId } = get();
    if (session_id !== activeSessionId && activeSessionId !== null) return;

    const resultText = is_error ? `[error]\n${content}` : `[result]\n${content}`;
    set((s) => {
      if (!s.activeSession) return {};
      const messages = s.activeSession.messages.map((m) =>
        m.id === `tool-call-${id}` ? { ...m, content: m.content + "\n\n" + resultText } : m
      );
      return { activeSession: { ...s.activeSession, messages } };
    });
  });

  // ── permission-request ───────────────────────────────────────────────────
  listen<PermissionRequest>("permission-request", (event) => {
    set({ pendingPermission: event.payload });
  });

  // ── Telegram / 外部频道写入会话后刷新列表 ───────────────────────────────
  listen<{ source?: string; session_id?: string }>("sessions-changed", (event) => {
    void get().loadSessions();
    const sid = event.payload.session_id;
    const { activeSessionId } = get();
    if (sid && sid === activeSessionId) {
      void get().selectSession(sid);
    }
  });

  // ── session-token-usage ──────────────────────────────────────────────────
  listen<TokenUsageEvent>("session-token-usage", (event) => {
    const { session_id, input_tokens, output_tokens, total_tokens } = event.payload;
    const { activeSessionId } = get();
    if (session_id !== activeSessionId && activeSessionId !== null) return;
    set({ tokenUsage: { input: input_tokens, output: output_tokens, total: total_tokens } });
  });

  // ── sub-agent events ──────────────────────────────────────────────────────
  listen<SubAgentStart>("subagent-start", (event) => {
    const { parent_session_id, task_id, prompt, agent } = event.payload;
    const { activeSessionId } = get();
    if (parent_session_id !== activeSessionId && activeSessionId !== null) return;
    const who = agent?.trim() ? agent : "子代理";
    const msg: Message = {
      id: `subagent-${task_id}`,
      role: "tool",
      content: `[tool: spawn_agent | ${JSON.stringify({ prompt, agent: who })}]\n[sub-agent starting] ${who}`,
      created: Date.now(),
    };
    set((s) => {
      const session = s.activeSession
        ? { ...s.activeSession, messages: [...s.activeSession.messages, msg] }
        : null;
      return { activeSession: session };
    });
  });

  listen<SubAgentDone>("subagent-done", (event) => {
    const { parent_session_id, task_id } = event.payload;
    const { activeSessionId } = get();
    if (parent_session_id !== activeSessionId && activeSessionId !== null) return;
    set((s) => {
      if (!s.activeSession) return {};
      const messages = s.activeSession.messages.map((m) =>
        m.id === `subagent-${task_id}`
          ? {
              ...m,
              content: m.content.replace(
                /\[sub-agent starting\][^\n]*/,
                "[sub-agent done]",
              ),
            }
          : m,
      );
      return { activeSession: { ...s.activeSession, messages } };
    });
  });

  return {
    sessions: [],
    sessionGroups: [],
    focusedGroupId: null,
    activeSessionId: null,
    activeSession: null,
    chatMode: readChatMode(),
    preferredAgentId: readPreferredAgentId(),
    streamingContent: "",
    isStreaming: false,
    thinkingContent: "",
    isThinking: false,
    pendingPermission: null,
    error: null,
    tokenUsage: null,

    clearError: () => set({ error: null }),

    abortSession: () => {
      const { activeSessionId } = get();
      if (!activeSessionId) return;
      void invoke("chat_abort", { sessionId: activeSessionId });
    },

    setFocusedGroupId: (groupId) => {
      set({ focusedGroupId: groupId });
    },

    setChatMode: (mode) => {
      try {
        localStorage.setItem(CHAT_MODE_KEY, mode);
      } catch { /* ignore */ }
      set({ chatMode: mode });
    },

    setPreferredAgentId: (agentId) => {
      try {
        if (agentId) localStorage.setItem(PREFERRED_AGENT_KEY, agentId);
        else localStorage.removeItem(PREFERRED_AGENT_KEY);
      } catch { /* ignore */ }
      set({ preferredAgentId: agentId });
    },

    setSessionAgent: async (agentId) => {
      const { activeSessionId } = get();
      if (!activeSessionId || activeSessionId === "pending") {
        get().setPreferredAgentId(agentId);
        return;
      }
      const session = await invoke<Session>("session_set_agent", {
        sessionId: activeSessionId,
        agentId,
      });
      set({
        activeSession: session,
        preferredAgentId: agentId,
      });
      try {
        localStorage.setItem(PREFERRED_AGENT_KEY, agentId);
      } catch { /* ignore */ }
      await get().loadSessions();
    },

    loadSessions: async () => {
      // 展示全部会话（不再按角色过滤）
      const sessions = await invoke<SessionSummary[]>("session_list", {
        agentId: null,
      });
      set({ sessions });
    },

    loadSessionGroups: async () => {
      const sessionGroups = await invoke<SessionGroup[]>("session_group_list");
      set({ sessionGroups });
    },

    selectSession: async (id: string) => {
      const session = await invoke<Session | null>("session_get", { sessionId: id });
      set({
        activeSessionId: id,
        activeSession: session,
        focusedGroupId: session?.group_id ?? null,
        streamingContent: "",
        isStreaming: false,
        thinkingContent: "",
        isThinking: false,
        error: null,
      });
    },

    sendMessage: async (content: string) => {
      const { activeSessionId, activeSession, focusedGroupId } = get();
      const now = Date.now();
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        created: now,
      };

      // 乐观更新：新会话也要立刻显示用户消息（之前 activeSession=null 导致界面空白）
      set({
        activeSession: activeSession
          ? { ...activeSession, messages: [...activeSession.messages, userMsg] }
          : {
              id: "pending",
              title: "New Chat",
              messages: [userMsg],
              created: now,
              updated: now,
              group_id: focusedGroupId,
            },
        streamingContent: "",
        isStreaming: true,
        thinkingContent: "",
        isThinking: false,
        error: null,
        tokenUsage: null,
      });

      try {
        const { chatMode, preferredAgentId, activeSession: cur } = get();
        const agentId = cur?.agent_id ?? preferredAgentId;
        const sessionId = await invoke<string>("chat_send", {
          sessionId: activeSessionId,
          content,
          mode: chatMode,
          groupId: activeSessionId ? null : focusedGroupId,
          agentId,
        });

        set((s) => ({
          activeSessionId: sessionId,
          activeSession:
            s.activeSession && s.activeSession.id === "pending"
              ? { ...s.activeSession, id: sessionId }
              : s.activeSession,
        }));

        // 若流式 done 已处理过，这里再拉一次保证最终一致；失败时也要解除转圈
        const session = await invoke<Session | null>("session_get", { sessionId });
        if (session) {
          set({
            activeSession: session,
            focusedGroupId: session.group_id ?? null,
            isStreaming: false,
            streamingContent: "",
          });
          await get().loadSessions();
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        set({
          isStreaming: false,
          streamingContent: "",
          error: message,
        });
      }
    },

    newSession: () => {
      set({
        activeSessionId: null,
        activeSession: null,
        streamingContent: "",
        isStreaming: false,
        thinkingContent: "",
        isThinking: false,
        error: null,
      });
    },

    renameSession: async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      await invoke("session_rename", { sessionId: id, title: trimmed });
      set((s) => ({
        sessions: s.sessions.map((item) =>
          item.id === id ? { ...item, title: trimmed } : item
        ),
        activeSession:
          s.activeSession?.id === id
            ? { ...s.activeSession, title: trimmed }
            : s.activeSession,
      }));
      await get().loadSessions();
    },

    deleteSession: async (id: string) => {
      await invoke("permission_clear_session_grants", { sessionId: id }).catch(
        () => undefined,
      );
      await invoke("session_delete", { sessionId: id });
      const { activeSessionId } = get();
      set((s) => ({
        sessions: s.sessions.filter((item) => item.id !== id),
      }));
      if (activeSessionId === id) {
        get().newSession();
      }
      await get().loadSessions();
    },

    pinSession: async (id: string, pinned: boolean) => {
      await invoke("session_pin", { sessionId: id, pinned });
      set((s) => ({
        sessions: s.sessions.map((item) =>
          item.id === id ? { ...item, pinned } : item
        ),
        activeSession:
          s.activeSession?.id === id
            ? { ...s.activeSession, pinned }
            : s.activeSession,
      }));
      await get().loadSessions();
    },

    setSessionGroup: async (sessionId, groupId) => {
      await invoke("session_set_group", { sessionId, groupId });
      await get().loadSessions();
    },

    createSessionGroup: async (name) => {
      const g = await invoke<SessionGroup>("session_group_create", { name });
      await get().loadSessionGroups();
      return g;
    },

    renameSessionGroup: async (groupId, name) => {
      await invoke("session_group_rename", { groupId, name });
      await get().loadSessionGroups();
    },

    deleteSessionGroup: async (groupId) => {
      await invoke("session_group_delete", { groupId });
      await get().loadSessionGroups();
    },

    respondPermission: async (requestId, allowed, remember = "once") => {
      set({ pendingPermission: null });
      await invoke("permission_respond", { requestId, allowed, remember });
    },
  };
});
