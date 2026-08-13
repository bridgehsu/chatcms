import { useEffect, useRef, useState } from "react";
import { IconSend } from "@/components/icons";
import { Select } from "@/components/Select";
import {
  FAMILY_OPTIONS,
  getVersionOptions,
} from "@/config/modelPresets";
import { useChatStore } from "@/stores/useChatStore";
import { usePermissionStore } from "@/stores/usePermissionStore";
import { useProviderStore } from "@/stores/useProviderStore";
import type { Message } from "@/types";
import { MarkdownContent } from "./MarkdownContent";
import { PermissionPrompt } from "./PermissionPrompt";
import { ToolMessage } from "./ToolMessage";

/**
 * 消息行（ChatGPT / Claude 范式）
 * - 无头像
 * - 用户：右对齐胶囊，纯文本
 * - 助手：左对齐 Markdown 渲染
 * - 工具：左对齐工具卡
 */
const MessageBubble = ({ msg }: { msg: Message }) => {
  if (msg.role === "tool") {
    return (
      <div className="message message--tool">
        <ToolMessage content={msg.content} />
      </div>
    );
  }

  if (msg.role === "user") {
    return (
      <div className="message message--user">
        <div className="message-body message-body--bubble">{msg.content}</div>
      </div>
    );
  }

  return (
    <div className={`message message--${msg.role}`}>
      <div className="message-body message-body--md">
        <MarkdownContent content={msg.content} />
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
  const {
    modes: permissionModes,
    activeModeId,
    load: loadPermissionModes,
    setActive: setActivePermissionMode,
  } = usePermissionStore();
  const [input, setInput] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadPermissionModes();
  }, [loadPermissionModes]);

  // 只滚消息容器，避免 scrollIntoView 带动整页导致会话区「空白」
  useEffect(() => {
    const root = messagesRef.current;
    if (!root) return;
    root.scrollTop = root.scrollHeight;
  }, [activeSession?.id, activeSession?.messages, streamingContent, error, pendingPermission]);

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
  const permissionOptions = permissionModes.map((m) => ({
    value: m.id,
    label: m.name,
  }));
  const permissionValue =
    activeModeId && permissionOptions.some((o) => o.value === activeModeId)
      ? activeModeId
      : (permissionOptions[0]?.value ?? "");

  const messages = activeSession?.messages ?? [];
  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="chat-window">
      <div className="messages" ref={messagesRef}>
        <div className="messages__inner">
          {isEmpty && (
            <div className="empty-state">
              <p className="empty-state__title">有什么可以帮你的？</p>
              <p className="empty-state__hint">
                在下方输入问题，或先到侧栏「模型」填写 API 密钥
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {isStreaming && (
            <div className="message message--assistant message--streaming">
              <div className="message-body message-body--md">
                <MarkdownContent content={streamingContent} streaming />
              </div>
            </div>
          )}

          {error && (
            <button
              type="button"
              className="message message--error"
              onClick={() => clearError()}
              title="点击关闭"
            >
              <div className="message-body message-body--error">{error}</div>
            </button>
          )}
        </div>
      </div>

      <div className="input-bar">
        <PermissionPrompt />
        {/* 模型选择行 */}
        <div className="input-bar__meta">
          <div className="input-bar__model">
            <Select
              aria-label="选择模型"
              value={familyId}
              options={[...FAMILY_OPTIONS]}
              onChange={(id) => void selectFamily(id)}
            />
            <Select
              aria-label="选择版本"
              value={versionId}
              options={versionOptions}
              onChange={(id) => void selectVersion(id)}
            />
          </div>
          {permissionOptions.length > 0 && (
            <Select
              className="composer__perm"
              aria-label="选择权限模式"
              placement="top"
              value={permissionValue}
              options={permissionOptions}
              onChange={(id) => void setActivePermissionMode(id)}
            />
          )}
        </div>
        <div className="composer">
          <div className="composer__body">
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
    </div>
  );
};
