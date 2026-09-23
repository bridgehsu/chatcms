import { useEffect, useRef, useState } from "react";
import { App as AntdApp, Button, Form, Input, Modal, Select, Space } from "antd";
import { useNavigate } from "react-router-dom";
import {
  readLastGroupId,
  useNotesStore,
} from "@/stores/useNotesStore";
import {
  guessTitleFromContent,
  listNotesByMessageId,
  saveAssistantReply,
} from "../utils/saveToContent";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  content: string;
  existingNoteId?: string | null;
};

export const SaveToContentModal = ({
  open,
  onClose,
  sessionId,
  sessionTitle,
  messageId,
  content,
  existingNoteId,
}: Props) => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const groups = useNotesStore((s) => s.groups);
  const hydrate = useNotesStore((s) => s.hydrate);
  const ready = useNotesStore((s) => s.ready);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"new" | "update">("new");
  const [form] = Form.useForm<{ title: string; groupId: string }>();
  const abortRef = useRef<AbortController | null>(null);

  const related = listNotesByMessageId(messageId);
  const latest =
    (existingNoteId && related.find((n) => n.id === existingNoteId)) ||
    related[0];

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setBusy(false);
      return;
    }
    if (!ready) void hydrate();
    const preferGroup =
      (latest?.groupId && groups.some((g) => g.id === latest.groupId)
        ? latest.groupId
        : null) ??
      (() => {
        const last = readLastGroupId();
        return last && groups.some((g) => g.id === last) ? last : "";
      })();
    form.setFieldsValue({
      title:
        latest?.title ||
        guessTitleFromContent(content, sessionTitle.trim() || "助手回复"),
      groupId: preferGroup || "",
    });
    setMode(latest ? "update" : "new");
  }, [
    open,
    content,
    sessionTitle,
    groups,
    form,
    ready,
    hydrate,
    latest?.id,
    latest?.groupId,
    latest?.title,
  ]);

  const handleCancel = () => {
    if (busy) {
      abortRef.current?.abort();
      abortRef.current = null;
      setBusy(false);
      message.info("已取消整理");
      return;
    }
    onClose();
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(true);
      const updating = mode === "update" && latest;
      const note = await saveAssistantReply({
        content,
        sessionId,
        sessionTitle,
        messageId,
        form: "summary",
        title: values.title,
        groupId: values.groupId || null,
        noteId: updating ? latest.id : null,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      const groupName =
        (values.groupId && groups.find((g) => g.id === values.groupId)?.name) ||
        "未分组";
      message.success({
        content: (
          <span>
            {updating ? "已整理并更新笔记" : "已整理并保存"}
            <span style={{ marginLeft: 6, opacity: 0.65 }}>· {groupName}</span>
            <a
              style={{ marginLeft: 10 }}
              onClick={() => {
                useNotesStore.getState().select(note.id);
                navigate("/content");
              }}
            >
              打开
            </a>
          </span>
        ),
        duration: 4,
      });
      onClose();
    } catch (e) {
      if (e && typeof e === "object" && "errorFields" in e) return;
      if (e instanceof Error && e.message === "已取消") return;
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  return (
    <Modal
      title="AI 整理后保存"
      open={open}
      onCancel={handleCancel}
      destroyOnHidden
      width={440}
      footer={
        <Space>
          <Button onClick={handleCancel}>{busy ? "停止" : "取消"}</Button>
          <Button type="primary" loading={busy} onClick={() => void handleOk()}>
            {busy
              ? "整理中…"
              : mode === "update"
                ? "整理并更新"
                : "整理并保存"}
          </Button>
        </Space>
      }
    >
      <p style={{ marginBottom: 16, color: "var(--text-dim)", fontSize: 13 }}>
        将调用当前模型整理这条回复，再写入内容管理（同步到知识库供 Agent 检索）。
        {related.length > 1
          ? ` 该回复已有 ${related.length} 篇关联笔记。`
          : ""}
      </p>
      {latest && (
        <Select
          style={{ width: "100%", marginBottom: 12 }}
          value={mode}
          disabled={busy}
          onChange={(v) => setMode(v as "new" | "update")}
          options={[
            { value: "update", label: `更新已有 · ${latest.title || "无标题"}` },
            { value: "new", label: "另存一篇新笔记" },
          ]}
        />
      )}
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: "请输入标题" }]}
        >
          <Input maxLength={80} placeholder="笔记标题" disabled={busy} />
        </Form.Item>
        <Form.Item name="groupId" label="分组">
          <Select
            disabled={busy}
            options={[
              { value: "", label: "未分组" },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
