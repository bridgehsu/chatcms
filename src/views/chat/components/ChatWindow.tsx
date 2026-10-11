import { memo, useEffect, useRef, useState } from "react";
import {
  CheckOutlined,
  CopyOutlined,
  DownOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { App as AntdApp, Button, Dropdown, Space, Tooltip, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { Select } from "@/components/Select";
import { IconSend, IconStop } from "@/components/icons";
import { useChatStore } from "@/stores/useChatStore";
import { useNotesStore } from "@/stores/useNotesStore";
import { usePermissionStore } from "@/stores/usePermissionStore";
import type { ChatAttachment, Message } from "@/types";
import {
  findLatestNoteByMessageId,
} from "../utils/saveToContent";
import { MarkdownContent } from "./MarkdownContent";
import MentionPicker, {
  toAttachment,
  type MentionOption,
} from "./MentionPicker";
import { ModePicker } from "./ModePicker";
import { ModelPicker, readAuto } from "./ModelPicker";
import { PermissionPrompt } from "./PermissionPrompt";
import { QuickSaveModal } from "./QuickSaveModal";
import { SaveToContentModal } from "./SaveToContentModal";
import { ToolMessage } from "./ToolMessage";

const ThinkingBubble = ({ content, thinking }: { content: string; thinking: boolean }) => {
  const [open, setOpen] = useState(thinking);

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

type AssistantActionsProps = {
  msg: Message;
  sessionId: string;
  sessionTitle: string;
  onPolish: (msg: Message) => void;
};

const AssistantActions = ({
  msg,
  sessionId,
  sessionTitle,
  onPolish,
}: AssistantActionsProps) => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const notes = useNotesStore((s) => s.notes);
  const related = notes
    .filter((n) => n.sourceMessageId === msg.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const savedNote = related[0];
  const savedCount = related.length;

  const toastSaved = (noteId: string, updated: boolean) => {
    const note = useNotesStore.getState().notes.find((n) => n.id === noteId);
    const groupName =
      (note?.groupId &&
        useNotesStore.getState().groups.find((g) => g.id === note.groupId)?.name) ||
      "未分组";
    message.success({
      content: (
        <span>
          {updated ? "已更新笔记" : "已保存到内容管理"}
          <Typography.Text type="secondary" style={{ marginLeft: 6 }}>
            · {groupName}
          </Typography.Text>
          <a
            style={{ marginLeft: 10 }}
            onClick={() => {
              useNotesStore.getState().select(noteId);
              navigate("/content");
            }}
          >
            打开
          </a>
        </span>
      ),
      duration: 4,
    });
  };

  const handleQuickSave = () => {
    if (!msg.content.trim()) {
      message.warning("没有可保存的内容");
      return;
    }
    setQuickOpen(true);
  };

  const handleCopy = async () => {
    const text = msg.content.trim();
    if (!text) {
      message.warning("没有可复制的内容");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      message.success("已复制");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      message.error("复制失败");
    }
  };

  const menuItems = [
    {
      key: "polish",
      label: "AI 整理后保存",
      onClick: () => onPolish(msg),
    },
    ...(savedNote
      ? [
          {
            key: "open",
            label:
              savedCount > 1
                ? `打开最近笔记（共 ${savedCount} 篇）`
                : "打开已存笔记",
            onClick: () => {
              useNotesStore.getState().select(savedNote.id);
              navigate("/content");
            },
          },
        ]
      : []),
  ];

  return (
    <div
      className={`message-actions${savedNote ? " is-saved" : ""}${menuOpen ? " is-open" : ""}`}
    >
      <Space size={0} className="message-actions__btns">
        <Tooltip title={copied ? "已复制" : "复制"}>
          <Button
            type="text"
            size="small"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={() => void handleCopy()}
            aria-label="复制"
          />
        </Tooltip>
        <Tooltip
          title={
            savedNote
              ? savedCount > 1
                ? `已保存 ${savedCount} 篇 · 点击管理`
                : "已保存 · 点击可更新或另存"
              : "保存到内容管理"
          }
        >
          <Button
            type="text"
            size="small"
            icon={savedNote ? <CheckOutlined /> : <SaveOutlined />}
            onClick={handleQuickSave}
            aria-label={savedNote ? "已保存" : "保存"}
            className={savedNote ? "message-actions__save is-done" : undefined}
          />
        </Tooltip>
        <Dropdown
          menu={{ items: menuItems }}
          trigger={["click"]}
          onOpenChange={setMenuOpen}
        >
          <Tooltip title="更多">
            <Button
              type="text"
              size="small"
              icon={<DownOutlined />}
              aria-label="更多保存选项"
            />
          </Tooltip>
        </Dropdown>
      </Space>
      <QuickSaveModal
        open={quickOpen}
        msg={msg}
        sessionId={sessionId}
        sessionTitle={sessionTitle}
        onClose={() => setQuickOpen(false)}
        onSaved={toastSaved}
      />
    </div>
  );
};

const MessageBubble = memo(
  ({
    msg,
    sessionId,
    sessionTitle,
    onPolish,
  }: {
    msg: Message;
    sessionId?: string;
    sessionTitle?: string;
    onPolish?: (msg: Message) => void;
  }) => {
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
        <div className="message__stack">
          <div className="message-body message-body--md">
            <MarkdownContent content={msg.content} />
          </div>
          {msg.role === "assistant" &&
            sessionId &&
            onPolish &&
            msg.content.trim() && (
              <AssistantActions
                msg={msg}
                sessionId={sessionId}
                sessionTitle={sessionTitle ?? ""}
                onPolish={onPolish}
              />
            )}
        </div>
      </div>
    );
  },
);

type ComposerProps = {
  onSend: (text: string, attachments?: ChatAttachment[]) => Promise<void>;
  isStreaming: boolean;
  pendingPermission: boolean;
  onAbort: () => void;
  tokenUsage: { input: number; output: number; total: number } | null;
  agentId?: string | null;
};

const Composer = ({
  onSend,
  isStreaming,
  pendingPermission,
  onAbort,
  tokenUsage,
  agentId,
}: ComposerProps) => {
  const {
    modes: permissionModes,
    activeModeId,
    load: loadPermissionModes,
    setActive: setActivePermissionMode,
  } = usePermissionStore();
  const { chatMode, setChatMode } = useChatStore();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [mention, setMention] = useState<{
    open: boolean;
    query: string;
    start: number;
  }>({ open: false, query: "", start: -1 });
  const [autoModel, setAutoModel] = useState(readAuto);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void loadPermissionModes();
  }, [loadPermissionModes]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const closeMention = () =>
    setMention({ open: false, query: "", start: -1 });

  const syncMentionFromValue = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at < 0) {
      closeMention();
      return;
    }
    if (at > 0 && !/\s/.test(before[at - 1] ?? " ")) {
      closeMention();
      return;
    }
    const frag = before.slice(at + 1);
    if (/\s/.test(frag)) {
      closeMention();
      return;
    }
    setMention({ open: true, query: frag, start: at });
  };

  const handlePickMention = (opt: MentionOption) => {
    const att = toAttachment(opt);
    setAttachments((prev) =>
      prev.some((a) => a.kind === att.kind && a.id === att.id)
        ? prev
        : [...prev, att],
    );
    if (mention.start >= 0) {
      const before = input.slice(0, mention.start);
      const after = input.slice(
        mention.start + 1 + mention.query.length,
      );
      setInput(`${before}${after}`);
    }
    closeMention();
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !attachments.length) || isStreaming) return;
    const payload = attachments;
    setInput("");
    setAttachments([]);
    closeMention();
    // 仅有 @ 附件时传空串；store 会拼成「@标签」，后端按「只 @ → 执行」
    await onSend(text, payload);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.open && ["ArrowDown", "ArrowUp", "Escape"].includes(e.key)) {
      // 交给 picker 的键盘（由 document 焦点在 textarea 时需本地处理导航）
      if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      if (mention.open) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      void handleSend();
    }
  };

  const permissionOptions = permissionModes.map((m) => ({
    value: m.id,
    label: m.name,
  }));
  const permissionValue =
    activeModeId && permissionOptions.some((o) => o.value === activeModeId)
      ? activeModeId
      : (permissionOptions[0]?.value ?? "");

  const showPermission = chatMode === "agent";
  const placeholder =
    chatMode === "ask"
      ? "提问或 @技能 / MCP…（Ask：不调用工具）"
      : chatMode === "search"
        ? "检索知识库，或 @ 引用技能…"
        : "描述任务，输入 @ 引用技能 / MCP…";

  return (
    <div className="input-bar">
      <PermissionPrompt />
      <div className="composer">
        {attachments.length > 0 && (
          <div className="composer__chips" aria-label="已引用">
            {attachments.map((a) => (
              <button
                key={`${a.kind}:${a.id}`}
                type="button"
                className={`composer__chip composer__chip--${a.kind}`}
                title="点击移除"
                onClick={() =>
                  setAttachments((prev) =>
                    prev.filter(
                      (x) => !(x.kind === a.kind && x.id === a.id),
                    ),
                  )
                }
              >
                <span className="composer__chip-kind">
                  {a.kind === "script"
                    ? "脚本"
                    : a.kind === "task"
                      ? "任务"
                      : a.kind === "skill"
                        ? "技能"
                        : "MCP"}
                </span>
                {a.label}
                <span className="composer__chip-x" aria-hidden>
                  ×
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="composer__body">
          <div className="composer__input-wrap">
            <MentionPicker
              open={mention.open}
              query={mention.query}
              agentId={agentId}
              excludeKeys={attachments.map((a) => `${a.kind}:${a.id}`)}
              onPick={handlePickMention}
              onClose={closeMention}
            />
            <textarea
              ref={textareaRef}
              className="input-textarea"
              value={input}
              onChange={(e) => {
                const v = e.target.value;
                setInput(v);
                syncMentionFromValue(v, e.target.selectionStart ?? v.length);
              }}
              onKeyDown={handleKeyDown}
              onClick={(e) =>
                syncMentionFromValue(
                  input,
                  (e.target as HTMLTextAreaElement).selectionStart ?? 0,
                )
              }
              placeholder={placeholder}
              rows={1}
              disabled={isStreaming || pendingPermission}
            />
          </div>
          {isStreaming ? (
            <button
              className="btn-stop"
              onClick={onAbort}
              type="button"
              aria-label="停止"
            >
              <IconStop />
            </button>
          ) : (
            <button
              className="btn-send"
              onClick={() => void handleSend()}
              disabled={
                pendingPermission || (!input.trim() && !attachments.length)
              }
              type="button"
              aria-label="发送"
            >
              <IconSend />
            </button>
          )}
        </div>
        <div className="composer__footer">
          <div className="composer__controls">
            <ModePicker
              value={chatMode}
              onChange={setChatMode}
              disabled={isStreaming || pendingPermission}
            />
            <ModelPicker autoModel={autoModel} onAutoChange={setAutoModel} />
            {showPermission && permissionOptions.length > 0 && (
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
          {tokenUsage && (
            <span
              className="composer__tokens"
              title={`输入 ${tokenUsage.input.toLocaleString()} · 输出 ${tokenUsage.output.toLocaleString()}`}
            >
              {tokenUsage.total.toLocaleString()} tokens
            </span>
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
  const [polishTarget, setPolishTarget] = useState<Message | null>(null);
  const hydrateNotes = useNotesStore((s) => s.hydrate);
  const notesReady = useNotesStore((s) => s.ready);

  useEffect(() => {
    if (!notesReady) void hydrateNotes();
  }, [notesReady, hydrateNotes]);

  useEffect(() => {
    const root = messagesRef.current;
    if (!root) return;
    root.scrollTop = root.scrollHeight;
  }, [activeSession?.id, activeSession?.messages, streamingContent, error, pendingPermission]);

  const messages = activeSession?.messages ?? [];
  const isEmpty = messages.length === 0 && !isStreaming;
  const existingForPolish = polishTarget
    ? findLatestNoteByMessageId(polishTarget.id)
    : undefined;

  return (
    <div className="chat-window">
      <div className="messages" ref={messagesRef}>
        <div className="messages__inner">
          {isEmpty && (
            <div className="empty-state">
              <p className="empty-state__title">有什么可以帮你的？</p>
              <p className="empty-state__hint">
                顶栏可选角色（含自动选角）；下方可切换 Ask / Agent / Search
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              sessionId={activeSession?.id}
              sessionTitle={activeSession?.title}
              onPolish={setPolishTarget}
            />
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
        agentId={activeSession?.agent_id}
      />

      {activeSession && polishTarget && (
        <SaveToContentModal
          open
          onClose={() => setPolishTarget(null)}
          sessionId={activeSession.id}
          sessionTitle={activeSession.title}
          messageId={polishTarget.id}
          content={polishTarget.content}
          existingNoteId={existingForPolish?.id}
        />
      )}
    </div>
  );
};
