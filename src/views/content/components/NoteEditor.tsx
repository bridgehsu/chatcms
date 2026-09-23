import { useMemo, useState } from "react";
import { LinkOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, Input, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "@/stores/useChatStore";
import { NOTE_TEMPLATES, type NoteTemplate } from "@/stores/useNotesStore";
import { ModelPicker, readAuto } from "@/views/chat/components/ModelPicker";
import type { AiNote } from "../types";
import { NoteNovelEditor } from "./NoteNovelEditor";

type Props = {
  note: AiNote | null;
  focusedGroupName: string;
  onChange: (patch: Partial<Pick<AiNote, "title" | "content" | "icon">>) => void;
  onCreate: (template?: NoteTemplate) => void;
};

const countWords = (text: string) => {
  const t = text.trim();
  if (!t) return 0;
  const cn = (t.match(/[\u4e00-\u9fff]/g) || []).join("").length;
  const en = t
    .replace(/[\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cn + en;
};

const formatUpdated = (ts: number) => {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  const h = `${d.getHours()}`.padStart(2, "0");
  const min = `${d.getMinutes()}`.padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
};

export const NoteEditor = ({
  note,
  focusedGroupName,
  onChange,
  onCreate,
}: Props) => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const selectSession = useChatStore((s) => s.selectSession);
  const [autoModel, setAutoModel] = useState(() => readAuto());

  const stats = useMemo(() => {
    if (!note) return null;
    return {
      chars: note.content.length,
      words: countWords(note.content),
    };
  }, [note]);

  if (!note) {
    return (
      <div className="note-editor note-editor--empty">
        <div className="note-editor__empty-card">
          <Typography.Title level={4} className="note-editor__empty-heading">
            开始写作
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="note-editor__empty-copy">
            新建到「{focusedGroupName}」。也可从智能会话保存回复到这里。
          </Typography.Paragraph>
          <Button type="primary" onClick={() => onCreate()}>
            新建空白笔记
          </Button>
          <div className="note-editor__templates">
            {NOTE_TEMPLATES.filter((t) => t.id !== "blank").map((t) => (
              <button
                key={t.id}
                type="button"
                className="note-editor__template"
                onClick={() => onCreate(t)}
              >
                <span className="note-editor__template-icon" aria-hidden>
                  {t.icon}
                </span>
                <span className="note-editor__template-label">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const jumpToSession = async () => {
    if (!note.sourceSessionId) return;
    navigate("/chat");
    try {
      await selectSession(note.sourceSessionId);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "无法打开来源会话");
    }
  };

  return (
    <div className="note-editor">
      <div className="note-editor__bar">
        <div className="note-editor__bar-left">
          <span className="note-editor__emoji" aria-hidden>
            {note.icon || "📄"}
          </span>
          <Input
            className="note-editor__title"
            variant="borderless"
            value={note.title}
            placeholder="无标题"
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>
        <div className="note-editor__bar-right">
          <ModelPicker
            autoModel={autoModel}
            onAutoChange={setAutoModel}
            allowAuto={false}
          />
        </div>
      </div>

      <div className="note-editor__scroll">
        <div className="note-editor__paper">
          {note.sourceSessionId && (
            <div className="note-editor__meta">
              <button
                type="button"
                className="note-editor__meta-link"
                onClick={() => void jumpToSession()}
              >
                <LinkOutlined /> {note.sourceSessionTitle || "来源会话"}
              </button>
            </div>
          )}

          <NoteNovelEditor
            noteId={note.id}
            content={note.content}
            onChange={(markdown) => onChange({ content: markdown })}
          />
        </div>
      </div>

      {stats && (
        <div className="note-editor__footer">
          <span className="note-editor__footer-stats">
            {stats.words} 词 · {formatUpdated(note.updatedAt)}
          </span>
        </div>
      )}
    </div>
  );
};
