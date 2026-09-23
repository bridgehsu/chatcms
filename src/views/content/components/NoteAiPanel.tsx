import { useEffect, useRef, useState } from "react";
import { App as AntdApp, Button, Input, Spin, Typography } from "antd";
import type { InputRef } from "antd";
import { invoke } from "@/hooks/useTauri";
import { AI_EDIT_ACTIONS } from "@/views/chat/utils/saveToContent";
import { MarkdownContent } from "@/views/chat/components/MarkdownContent";

export type NoteAiScope = "selection" | "document" | "insert";

type Props = {
  open: boolean;
  scope: NoteAiScope;
  sourceText: string;
  anchor: { top: number; left: number } | null;
  onClose: () => void;
  onAccept: (markdown: string, scope: NoteAiScope) => void;
};

export const NoteAiPanel = ({
  open,
  scope,
  sourceText,
  anchor,
  onClose,
  onAccept,
}: Props) => {
  const { message } = AntdApp.useApp();
  const [customPrompt, setCustomPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<InputRef>(null);
  const genRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setCustomPrompt("");
      setPreview(null);
      setBusy(false);
      genRef.current += 1;
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (busy) {
          genRef.current += 1;
          setBusy(false);
          message.info("已取消生成");
          return;
        }
        if (preview != null) setPreview(null);
        else onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && preview != null) {
        e.preventDefault();
        onAccept(preview, scope);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, preview, scope, onAccept, onClose, busy, message]);

  if (!open || !anchor) return null;

  const run = async (system: string, content: string) => {
    const body = content.trim();
    if (!body && scope !== "insert") {
      message.warning("没有可改写的内容");
      return;
    }
    const gen = ++genRef.current;
    setBusy(true);
    try {
      const result = await invoke<string>("chat_complete", {
        content: body || customPrompt.trim() || "请根据指令写作",
        systemPrompt: system,
      });
      if (gen !== genRef.current) return;
      setPreview(result.trim());
    } catch (e) {
      if (gen !== genRef.current) return;
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      if (gen === genRef.current) setBusy(false);
    }
  };

  const scopeLabel =
    scope === "selection" ? "改写选区" : scope === "document" ? "改写全文" : "在光标处生成";

  return (
    <div
      className="note-ai-panel"
      style={{ top: anchor.top, left: anchor.left }}
      role="dialog"
      aria-label="AI 改写"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="note-ai-panel__head">
        <Typography.Text strong className="note-ai-panel__title">
          Ask AI
        </Typography.Text>
        <Typography.Text type="secondary" className="note-ai-panel__scope">
          {scopeLabel} · Models 当前模型
        </Typography.Text>
      </div>

      {preview == null ? (
        <>
          <div className="note-ai-panel__actions">
            {AI_EDIT_ACTIONS.map((a) => (
              <Button
                key={a.id}
                size="small"
                disabled={busy || (scope !== "insert" && !sourceText.trim())}
                onClick={() => void run(a.system, sourceText)}
              >
                {a.label}
              </Button>
            ))}
          </div>
          <Input.TextArea
            ref={inputRef}
            rows={2}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={
              scope === "insert"
                ? "描述要写的内容…"
                : "自定义指令，例如：改成小红书口吻"
            }
            disabled={busy}
            onPressEnter={(e) => {
              if (e.shiftKey) return;
              e.preventDefault();
              if (!customPrompt.trim() || busy) return;
              void run(
                `按用户指令${scope === "insert" ? "写作" : "改写文稿"}。指令：${customPrompt.trim()}。只输出 Markdown 正文，不要解释。`,
                scope === "insert" ? customPrompt.trim() : sourceText,
              );
            }}
          />
          <div className="note-ai-panel__footer">
            <Button
              size="small"
              type="text"
              onClick={() => {
                if (busy) {
                  genRef.current += 1;
                  setBusy(false);
                  message.info("已取消生成");
                } else onClose();
              }}
            >
              {busy ? "停止 Esc" : "取消 Esc"}
            </Button>
            <Button
              size="small"
              type="primary"
              loading={busy}
              disabled={!customPrompt.trim()}
              onClick={() =>
                void run(
                  `按用户指令${scope === "insert" ? "写作" : "改写文稿"}。指令：${customPrompt.trim()}。只输出 Markdown 正文，不要解释。`,
                  scope === "insert" ? customPrompt.trim() : sourceText,
                )
              }
            >
              生成
            </Button>
          </div>
          {busy && (
            <div className="note-ai-panel__loading">
              <Spin size="small" /> 生成中…
            </div>
          )}
        </>
      ) : (
        <>
          <div className="note-ai-panel__preview">
            <MarkdownContent content={preview} />
          </div>
          <div className="note-ai-panel__footer">
            <Button size="small" onClick={() => setPreview(null)}>
              重来
            </Button>
            <Button size="small" type="text" onClick={onClose}>
              拒绝 Esc
            </Button>
            <Button size="small" type="primary" onClick={() => onAccept(preview, scope)}>
              接受 ⌘↵
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
