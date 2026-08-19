import { memo, useEffect, useRef, useState } from "react";
import { IconSend, IconStop } from "@/components/icons";
import { Select } from "@/components/Select";
import { useChatStore } from "@/stores/useChatStore";
import { usePermissionStore } from "@/stores/usePermissionStore";
import type { Message } from "@/types";
import { MarkdownContent } from "./MarkdownContent";
import { ModelPicker, readAuto } from "./ModelPicker";
import { PermissionPrompt } from "./PermissionPrompt";
import { ToolMessage } from "./ToolMessage";

/**
 * 思考过程气泡（可折叠）
 * - thinking=true：思考中，标题带动画点
 * - thinking=false：思考完成，默认折叠
 */
const ThinkingBubble = ({ content, thinking }: { content: string; thinking: boolean }) => {
  const [open, setOpen] = useState(thinking);

  // 思考中自动展开，结束后保持当前状态
  useEffect(() => {
    if (thinking) setOpen(true);
  }, [thinking]);

  return (
    <div className="message message--thinking">
      <button
        type="button"
        className="thinking-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="thinking-header__icon">{open ? "▾" : "▸"}</span>
        <span className="thinking-header__label">
          {thinking ? "思考中" : "已完成思考"}
        </span>
        {thinking && <span className="thinking-header__dots" aria-hidden />}
      </button>
      {open && content && (
        <div className="thinking-body">
          <pre className="thinking-body__text">{content}</pre>
        </div>
      )}
    </div>
  );
};

/**
 * 消息行（ChatGPT / Claude 范式）
 * - 无头像
 * - 用户：右对齐胶囊，纯文本
 * - 助手：左对齐 Markdown 渲染
 * - 工具：左对齐工具卡
 */
const MessageBubble = memo(({ msg }: { msg: Message }) => {
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
});

// ── 独立的输入框组件，按键时只重渲自身，不触发消息列表重渲 ──────────────────
type ComposerProps = {
  onSend: (text: string) => Promise<void>;
  isStreaming: boolean;
  pendingPermission: boolean;
  onAbort: () => void;
  tokenUsage: { input: number; output: number; total: number } | null;
};

const Composer = ({ onSend, isStreaming, pendingPermission, onAbort, tokenUsage }: ComposerProps) => {
  const { modes: permissionModes, activeModeId, load: loadPermissionModes, setActive: setActivePermissionMode } = usePermissionStore();
  const [input, setInput] = useState("");
  const [autoModel, setAutoModel] = useState(readAuto);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { void loadPermissionModes(); }, [loadPermissionModes]);

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
    await onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const permissionOptions = permissionModes.map((m) => ({ value: m.id, label: m.name }));
  const permissionValue =
    activeModeId && permissionOptions.some((o) => o.value === activeModeId)
      ? activeModeId
      : (permissionOptions[0]?.value ?? "");

  return (
    <div className="input-bar">
      <PermissionPrompt />
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
            disabled={isStreaming || pendingPermission}
          />
          {isStreaming ? (
            <button className="btn-stop" onClick={onAbort} type="button" aria-label="停止">
              <IconStop />
            </button>
          ) : (
            <button
              className="btn-send"
              onClick={() => void handleSend()}
              disabled={pendingPermission || !input.trim()}
              type="button"
              aria-label="发送"
            >
              <IconSend />
            </button>
          )}
        </div>
        <div className="composer__footer">
          <ModelPicker autoModel={autoModel} onAutoChange={setAutoModel} />
          {tokenUsage && (
            <span className="composer__tokens" title={`输入 ${tokenUsage.input.toLocaleString()} · 输出 ${tokenUsage.output.toLocaleString()}`}>
              {tokenUsage.total.toLocaleString()} tokens
            </span>
          )}
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
      </div>
    </div>
  );
};

export const ChatWindow = () => {
  const {
    activeSession,
    streamingContent,
    isStreaming,
    thinkingContent,
    isThinking,
    error,
    pendingPermission,
    tokenUsage,
    sendMessage,
    abortSession,
    clearError,
  } = useChatStore();
  const messagesRef = useRef<HTMLDivElement>(null);

  // 只滚消息容器，避免 scrollIntoView 带动整页导致会话区「空白」
  useEffect(() => {
    const root = messagesRef.current;
    if (!root) return;
    root.scrollTop = root.scrollHeight;
  }, [activeSession?.id, activeSession?.messages, streamingContent, error, pendingPermission]);

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

          {(isThinking || (!isThinking && thinkingContent)) && (
            <ThinkingBubble content={thinkingContent} thinking={isThinking} />
          )}

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

      <Composer
        onSend={sendMessage}
        isStreaming={isStreaming}
        pendingPermission={!!pendingPermission}
        onAbort={abortSession}
        tokenUsage={tokenUsage}
      />
    </div>
  );
};
