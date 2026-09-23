import { useEffect, useState } from "react";
import { App as AntdApp, Button, Modal, Select, Space, Typography } from "antd";
import { readLastGroupId, useNotesStore } from "@/stores/useNotesStore";
import {
  listNotesByMessageId,
  saveAssistantReply,
} from "@/views/chat/utils/saveToContent";
import type { Message } from "@/types";

type Props = {
  open: boolean;
  msg: Message | null;
  sessionId: string;
  sessionTitle: string;
  onClose: () => void;
  onSaved: (noteId: string, updated: boolean) => void;
};

export const QuickSaveModal = ({
  open,
  msg,
  sessionId,
  sessionTitle,
  onClose,
  onSaved,
}: Props) => {
  const { message } = AntdApp.useApp();
  const groups = useNotesStore((s) => s.groups);
  const hydrate = useNotesStore((s) => s.hydrate);
  const ready = useNotesStore((s) => s.ready);
  const [groupId, setGroupId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"new" | "update">("new");

  const existing = msg ? listNotesByMessageId(msg.id) : [];
  const latest = existing[0];

  useEffect(() => {
    if (!open) return;
    if (!ready) void hydrate();
    if (latest?.groupId && groups.some((g) => g.id === latest.groupId)) {
      setGroupId(latest.groupId);
    } else {
      const last = readLastGroupId();
      const valid =
        last && groups.some((g) => g.id === last) ? last : "";
      setGroupId(valid);
    }
    setMode(latest ? "update" : "new");
  }, [open, ready, hydrate, groups, latest?.id, latest?.groupId]);

  const run = async () => {
    if (!msg?.content.trim()) {
      message.warning("没有可保存的内容");
      return;
    }
    setBusy(true);
    try {
      const note = await saveAssistantReply({
        content: msg.content,
        sessionId,
        sessionTitle,
        messageId: msg.id,
        form: "transcript",
        groupId: groupId || null,
        noteId: mode === "update" && latest ? latest.id : null,
      });
      onSaved(note.id, mode === "update");
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="保存到内容管理"
      open={open}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button type="primary" loading={busy} onClick={() => void run()}>
            {mode === "update" ? "更新笔记" : "保存"}
          </Button>
        </Space>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          将以原文保存本条助手回复
          {existing.length > 1
            ? `（该回复已有 ${existing.length} 篇关联笔记，更新默认改最近一篇）`
            : latest
              ? `（已关联笔记「${latest.title || "无标题"}」）`
              : ""}
        </Typography.Text>

        {latest && (
          <Select
            value={mode}
            onChange={(v) => setMode(v as "new" | "update")}
            options={[
              { value: "update", label: `更新已有 · ${latest.title || "无标题"}` },
              { value: "new", label: "另存一篇新笔记" },
            ]}
          />
        )}

        <div>
          <Typography.Text style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
            分组
          </Typography.Text>
          <Select
            style={{ width: "100%" }}
            value={groupId}
            onChange={setGroupId}
            options={[
              { value: "", label: "未分组" },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
        </div>
      </div>
    </Modal>
  );
};
