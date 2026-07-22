import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/chat";
import type { Message } from "../types";

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === "tool") {
    // Parse tool call / result display
    const lines = msg.content.split("\n");
    const header = lines[0];
    const body = lines.slice(1).join("\n");
    const isError = header.startsWith("[error]") || body.includes("[error]");
    return (
      <div className="message tool">
        <div className="message-role">Tool</div>
        <div className={`tool-block ${isError ? "tool-error" : ""}`}>
          <div className="tool-header">{header}</div>
          {body && <pre className="tool-body">{body}</pre>}
        </div>
      </div>
    );
  }

  return (
    <div className={`message ${msg.role}`}>
      <div className="message-role">
        {msg.role === "user" ? "You" : "Assistant"}
      </div>
      <div className="message-content" style={{ whiteSpace: "pre-wrap" }}>
        {msg.content}
      </div>
    </div>
  );
}

export function ChatWindow() {
  const { activeSession, streamingContent, isStreaming, sendMessage } = useChatStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, streamingContent]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages = activeSession?.messages ?? [];

  return (
    <div className="chat-window">
      <div className="messages">
        {messages.length === 0 && !isStreaming && (
          <div className="empty-state">
            <p>Start a conversation</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isStreaming && streamingContent && (
          <div className="message assistant streaming">
            <div className="message-role">Assistant</div>
            <div className="message-content" style={{ whiteSpace: "pre-wrap" }}>
              {streamingContent}
              <span className="cursor" />
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
          placeholder="Message… (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={isStreaming}
        />
        <button
          className="btn-send"
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
