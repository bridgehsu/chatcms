import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/useChatStore";
import type { Message } from "@/types";

const MessageBubble = ({ msg }: { msg: Message }) => {
  if (msg.role === "tool") {
    const lines = msg.content.split("\n");
    const header = lines[0];
    const body = lines.slice(1).join("\n");
    const isError = header.startsWith("[error]") || body.includes("[error]");
    return (
      <div className="message tool">
        <div className="message-role">工具</div>
        <div className={`tool-block ${isError ? "tool-error" : ""}`}>
          <div className="tool-header">{header}</div>
          {body && <pre className="tool-body">{body}</pre>}
        </div>
      </div>
    );
  }

  return (
    <div className={`message ${msg.role}`}>
      <div className="message-role">{msg.role === "user" ? "我" : "助手"}</div>
      <div className="message-content" style={{ whiteSpace: "pre-wrap" }}>
        {msg.content}
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
    sendMessage,
    clearError,
  } = useChatStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, streamingContent, error]);

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

  const messages = activeSession?.messages ?? [];

  return (
    <div className="chat-window">
      <div className="messages">
        {messages.length === 0 && !isStreaming && (
          <div className="empty-state">
            <p>开始对话</p>
            <p className="empty-hint">请先在左下角「设置」中填写 API 密钥</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isStreaming && (
          <div className="message assistant streaming">
            <div className="message-role">助手</div>
            <div className="message-content" style={{ whiteSpace: "pre-wrap" }}>
              {streamingContent || "思考中…"}
              <span className="cursor" />
            </div>
          </div>
        )}

        {error && (
          <div className="message system error-banner" onClick={() => clearError()}>
            <div className="message-role">错误</div>
            <div className="message-content" style={{ whiteSpace: "pre-wrap" }}>
              {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="input-bar">
        <textarea
          className="input-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息…（Enter 发送，Shift+Enter 换行）"
          rows={1}
          disabled={isStreaming}
        />
        <button
          className="btn-send"
          onClick={() => void handleSend()}
          disabled={isStreaming || !input.trim()}
          type="button"
        >
          {isStreaming ? "…" : "发送"}
        </button>
      </div>
    </div>
  );
};
