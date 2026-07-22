import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  Message,
  PermissionRequest,
  Session,
  SessionSummary,
  StreamChunk,
  SubAgentDone,
  SubAgentStart,
  ToolCallEvent,
  ToolResultEvent,
} from "../types";

interface ChatState {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeSession: Session | null;
  streamingContent: string;
  isStreaming: boolean;
  pendingPermission: PermissionRequest | null;

  loadSessions: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  newSession: () => void;
  respondPermission: (requestId: string, allowed: boolean) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => {
  // ── stream-chunk ─────────────────────────────────────────────────────────
  listen<StreamChunk>("stream-chunk", (event) => {
    const { session_id, delta, done } = event.payload;
    const { activeSessionId } = get();

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
          });
        }
      });
      get().loadSessions();
    } else {
      set((s) => ({ streamingContent: s.streamingContent + delta, isStreaming: true }));
    }
  });

  // ── tool-call ────────────────────────────────────────────────────────────
  listen<ToolCallEvent>("tool-call", (event) => {
    const { session_id, id, name, input } = event.payload;
    const { activeSessionId } = get();
    if (session_id !== activeSessionId && activeSessionId !== null) return;

    // Append an in-progress tool-call display message
    const display = `[calling: ${name}]\n${JSON.stringify(input, null, 2)}`;
    const msg: Message = {
      id: `tool-call-${id}`,
      role: "tool",
      content: display,
      created_at: Date.now(),
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

    // Update the matching tool-call message with the result
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

  // ── sub-agent events ──────────────────────────────────────────────────────
  listen<SubAgentStart>("subagent-start", (event) => {
    const { parent_session_id, task_id, prompt } = event.payload;
    const { activeSessionId } = get();
    if (parent_session_id !== activeSessionId && activeSessionId !== null) return;
    const msg: Message = {
      id: `subagent-${task_id}`,
      role: "tool",
      content: `[sub-agent starting]\n${prompt}`,
      created_at: Date.now(),
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
    streamingContent: "",
    isStreaming: false,
    pendingPermission: null,

    loadSessions: async () => {
      const sessions = await invoke<SessionSummary[]>("session_list");
      set({ sessions });
    },

    selectSession: async (id: string) => {
      const session = await invoke<Session | null>("session_get", { sessionId: id });
      set({ activeSessionId: id, activeSession: session, streamingContent: "" });
    },

    sendMessage: async (content: string) => {
      const { activeSessionId } = get();

      // Optimistically append user message
      set((s) => {
        const msg: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content,
          created_at: Date.now(),
        };
        const session = s.activeSession
          ? { ...s.activeSession, messages: [...s.activeSession.messages, msg] }
          : null;
        return { activeSession: session, streamingContent: "", isStreaming: true };
      });

      const sessionId = await invoke<string>("chat_send", {
        sessionId: activeSessionId,
        content,
      });

      if (!activeSessionId) {
        set({ activeSessionId: sessionId });
      }
    },

    newSession: () => {
      set({ activeSessionId: null, activeSession: null, streamingContent: "" });
    },

    respondPermission: async (requestId: string, allowed: boolean) => {
      set({ pendingPermission: null });
      await invoke("permission_respond", { requestId, allowed });
    },
  };
});
