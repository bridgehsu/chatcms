import { create } from "zustand";
import { invoke, listen } from "@/hooks/useTauri";
import type {
  Message,
  PermissionRequest,
  RememberScope,
  Session,
  SessionSummary,
  StreamChunk,
  SubAgentDone,
  SubAgentStart,
  TokenUsageEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "@/types";

interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

interface ChatState {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeSession: Session | null;
  activeAgentId: string | null;
  streamingContent: string;
  isStreaming: boolean;
  pendingPermission: PermissionRequest | null;
  error: string | null;
  tokenUsage: TokenUsage | null;

  setActiveAgent: (agentId: string | null) => void;
  loadSessions: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  abortSession: () => void;
  newSession: () => void;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  pinSession: (id: string, pinned: boolean) => Promise<void>;
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
    const { parent_session_id, task_id, prompt } = event.payload;
    const { activeSessionId } = get();
    if (parent_session_id !== activeSessionId && activeSessionId !== null) return;
    const msg: Message = {
      id: `subagent-${task_id}`,
      role: "tool",
      content: `[sub-agent starting]\n${prompt}`,
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
          ? { ...m, content: m.content.replace("[sub-agent starting]", "[sub-agent done]") }
          : m
      );
      return { activeSession: { ...s.activeSession, messages } };
    });
  });

  return {
    sessions: [],
    activeSessionId: null,
    activeSession: null,
    activeAgentId: null,
    streamingContent: "",
    isStreaming: false,
    pendingPermission: null,
    error: null,
    tokenUsage: null,

    clearError: () => set({ error: null }),

    abortSession: () => {
      const { activeSessionId } = get();
      if (!activeSessionId) return;
      void invoke("chat_abort", { sessionId: activeSessionId });
    },

    setActiveAgent: (agentId) => {
      set({ activeAgentId: agentId, activeSessionId: null, activeSession: null, error: null });
      void get().loadSessions();
    },

    loadSessions: async () => {
      const { activeAgentId } = get();
      const sessions = await invoke<SessionSummary[]>("session_list", {
        agentId: activeAgentId ?? null,
      });
      set({ sessions });
    },

    selectSession: async (id: string) => {
      const session = await invoke<Session | null>("session_get", { sessionId: id });
      set({
        activeSessionId: id,
        activeSession: session,
        streamingContent: "",
        isStreaming: false,
        error: null,
      });
    },

    sendMessage: async (content: string) => {
      const { activeSessionId, activeSession } = get();
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
            },
        streamingContent: "",
        isStreaming: true,
        error: null,
        tokenUsage: null,
      });

      try {
        const { activeAgentId } = get();
        const sessionId = await invoke<string>("chat_send", {
          sessionId: activeSessionId,
          agentId: activeAgentId ?? null,
          content,
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

    respondPermission: async (requestId, allowed, remember = "once") => {
      set({ pendingPermission: null });
      await invoke("permission_respond", { requestId, allowed, remember });
    },
  };
});
