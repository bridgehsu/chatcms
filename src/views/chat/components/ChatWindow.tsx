import { useEffect, useRef, useState } from "react";
import { IconBot, IconChat, IconSend, IconUser } from "@/components/icons";
import { Select } from "@/components/Select";
import {
  FAMILY_OPTIONS,
  getVersionOptions,
} from "@/config/modelPresets";
import { useChatStore } from "@/stores/useChatStore";
import { useProviderStore } from "@/stores/useProviderStore";
import type { Message } from "@/types";
import { PermissionPrompt } from "./PermissionPrompt";
import { ToolMessage } from "./ToolMessage";

const MessageBubble = ({ msg }: { msg: Message }) => {
  if (msg.role === "tool") {
    return (
      <div className="message tool">
        <div className="message-row">
          <span className="message-avatar message-avatar--tool" aria-label="工具">
            <IconBot />
          </span>
          <div className="message-col">
            <ToolMessage content={msg.content} />
          </div>
        </div>
      </div>
    );
  }

  const isUser = msg.role === "user";

  return (
    <div className={`message ${msg.role}`}>
      <div className="message-row">
        <span
          className={`message-avatar message-avatar--${msg.role}`}
          aria-label={isUser ? "我" : "助手"}
        >
          {isUser ? <IconUser /> : <IconBot />}
        </span>
        <div className="message-col">
          <div className="message-bubble">{msg.content}</div>
        </div>
      </div>
    </div>
  );
};

export const ChatWindow = () => {
  const {
    activeSession,
    streamingContent,
    isStreaming,
    error,
    pendingPermission,
    sendMessage,
    clearError,
  } = useChatStore();
  const { familyId, versionId, load, selectFamily, selectVersion } = useProviderStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, streamingContent, error, pendingPermission]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const versionOptions = getVersionOptions(familyId);

  const messages = activeSession?.messages ?? [];
  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="chat-window">
      <div className="chat-toolbar">
        <div className="chat-toolbar__cascade">
          <span className="chat-toolbar__label">模型</span>
          <div className="chat-toolbar__field">
            <Select
              aria-label="选择模型"
              value={familyId}
              options={[...FAMILY_OPTIONS]}
              onChange={(id) => void selectFamily(id)}
            />
          </div>
          <div className="chat-toolbar__field">
            <Select
              aria-label="选择版本"
              value={versionId}
              options={versionOptions}
              onChange={(id) => void selectVersion(id)}
            />
          </div>
        </div>
      </div>

      <div className="messages">
        {isEmpty && (
          <div className="empty-state">
            <div className="empty-state__icon">
              <IconChat />
            </div>
            <p className="empty-state__title">开始对话</p>
            <p className="empty-state__hint">
              在下方输入问题，或先到侧栏「模型配置」填写 API 密钥
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isStreaming && (
          <div className="message assistant streaming">
            <div className="message-row">
              <span className="message-avatar message-avatar--assistant" aria-label="助手">
                <IconBot />
              </span>
              <div className="message-col">
                <div className="message-bubble">
                  {streamingContent || "思考中…"}
                  <span className="cursor" />
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="message system error-banner" onClick={() => clearError()}>
            <div className="message-row">
              <span className="message-avatar message-avatar--error" aria-label="错误">
                !
              </span>
              <div className="message-col">
                <div className="message-bubble is-error">{error}</div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="input-bar">
        <PermissionPrompt />
        <div className="composer">
          <textarea
            ref={textareaRef}
            className="input-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息…（Enter 发送，Shift+Enter 换行）"
            rows={1}
            disabled={isStreaming || !!pendingPermission}
          />
          <button
            className="btn-send"
            onClick={() => void handleSend()}
            disabled={isStreaming || !!pendingPermission || !input.trim()}
            type="button"
            aria-label="发送"
          >
            {isStreaming ? <span className="btn-send__dots">…</span> : <IconSend />}
          </button>
        </div>
      </div>
    </div>
  );
};
