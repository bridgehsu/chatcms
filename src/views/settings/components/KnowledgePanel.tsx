import { useEffect, useMemo, useState } from "react";
import { App as AntdApp, Button, Input, Modal, Tag } from "antd";
import { ExportOutlined } from "@ant-design/icons";
import { invoke } from "@/hooks/useTauri";
import CabinX, { ActionOverflow, type CabinXColumn } from "@/components/CabinX";
import { formatTime } from "@/utils/time";
import type {
  KnowledgeEntry,
  KnowledgeExportResult,
  KnowledgeSiteProfile,
} from "@/types";

const DEFAULT_EXPORT =
  "/Users/xukui/demo-workspace/chatcms.org/content";

const KIND_OPTIONS = [
  { label: "全部类型", value: "all" },
  { label: "笔记", value: "note" },
  { label: "文档", value: "doc" },
  { label: "FAQ", value: "faq" },
];

const VIS_OPTIONS = [
  { label: "全部可见", value: "all" },
  { label: "私有", value: "private" },
  { label: "公开", value: "public" },
];

const kindLabel = (k?: string) => {
  if (k === "doc") return "文档";
  if (k === "faq") return "FAQ";
  return "笔记";
};

const parseTags = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw ?? "")
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
};

const entryTimeMs = (record: KnowledgeEntry) => {
  const t = record.updated || record.created || 0;
  return t < 1e12 ? t * 1000 : t;
};

/** 智能配置 · 知识库列表 */
export const KnowledgePanel = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);

  const api = useMemo(
    () => ({
      paging: async (params: Record<string, unknown>) => {
        void refreshKey;
        let list = await invoke<KnowledgeEntry[]>("knowledge_list");
        if (params?.visibility && params.visibility !== "all") {
          list = list.filter(
            (e) =>
              (e.visibility === "public" ? "public" : "private") ===
              params.visibility,
          );
        }
        if (params?.kind && params.kind !== "all") {
          list = list.filter((e) => (e.kind || "note") === params.kind);
        }
        if (typeof params?.keyword === "string" && params.keyword.trim()) {
          const q = params.keyword.trim().toLowerCase();
          list = list.filter((e) =>
            [e.title, e.description, e.content, ...(e.tags ?? []), e.slug ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(q),
          );
        }
        return {
          list,
          total: list.length,
          pageNum: 1,
          pageSize: Math.max(list.length, 10),
        };
      },
      add: async (data: Record<string, unknown>) =>
        invoke("knowledge_add", {
          title: data.title,
          description: data.description ?? "",
          content: data.content,
          tags: data.tags ?? [],
          visibility: data.visibility ?? "private",
          kind: data.kind ?? "note",
          slug: data.slug ?? "",
        }),
      edit: async (data: Record<string, unknown>) => {
        const { id, ...rest } = data;
        return invoke("knowledge_update", {
          id,
          title: rest.title,
          description: rest.description ?? "",
          content: rest.content,
          tags: rest.tags ?? [],
          visibility: rest.visibility ?? "private",
          kind: rest.kind ?? "note",
          slug: rest.slug ?? "",
        });
      },
      del: async (id: string | number) =>
        invoke("knowledge_remove", { id: String(id) }),
    }),
    [refreshKey],
  );

  const formatRecordForEdit = (record: KnowledgeEntry) => ({
    title: record.title,
    description: record.description ?? "",
    content: record.content,
    tags: (record.tags ?? []).join(", "),
    visibility: record.visibility === "public" ? "public" : "private",
    kind: record.kind === "doc" || record.kind === "faq" ? record.kind : "note",
    slug: record.slug ?? "",
  });

  const beforeSubmit = (values: Record<string, unknown>) => ({
    title: String(values.title ?? "").trim(),
    description: String(values.description ?? "").trim(),
    content: String(values.content ?? "").trim(),
    tags: parseTags(values.tags),
    visibility: values.visibility ?? "private",
    kind: values.kind ?? "note",
    slug: String(values.slug ?? "").trim(),
  });

  const columns: CabinXColumn<KnowledgeEntry>[] = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      search: {
        name: "keyword",
        label: "关键词",
        type: "input",
        placeholder: "搜索标题、内容、标签…",
      },
      editor: {
        name: "title",
        label: "标题",
        type: "input",
        rules: [{ required: true, message: "请输入标题" }],
        placeholder: "项目背景 / 运营规范…",
      },
      render: (title: string, record) => (
        <>
          <span>{title}</span>
          {record.slug ? (
            <div className="account-table__notes">/{record.slug}</div>
          ) : null}
        </>
      ),
    },
    {
      title: "可见",
      dataIndex: "visibility",
      key: "visibility",
      width: 88,
      search: {
        name: "visibility",
        label: "可见性",
        type: "select",
        options: VIS_OPTIONS,
        placeholder: "全部",
      },
      editor: {
        name: "visibility",
        label: "可见性",
        type: "select",
        options: [
          { label: "私有（仅本机 Agent）", value: "private" },
          { label: "公开（可导出站点）", value: "public" },
        ],
        initialValue: "private",
      },
      render: (v?: string) =>
        v === "public" ? <Tag color="blue">公开</Tag> : <Tag>私有</Tag>,
    },
    {
      title: "类型",
      dataIndex: "kind",
      key: "kind",
      width: 80,
      search: {
        name: "kind",
        label: "类型",
        type: "select",
        options: KIND_OPTIONS,
        placeholder: "全部",
      },
      editor: {
        name: "kind",
        label: "类型",
        type: "select",
        options: [
          { label: "笔记", value: "note" },
          { label: "文档", value: "doc" },
          { label: "FAQ", value: "faq" },
        ],
        initialValue: "note",
      },
      render: (k?: string) => kindLabel(k),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      editor: {
        name: "description",
        label: "描述（检索摘要）",
        type: "input",
        placeholder: "简短摘要，便于匹配",
      },
      render: (d?: string) => d || "—",
    },
    {
      title: "内容",
      dataIndex: "content",
      key: "content",
      hideInTable: true,
      editor: {
        name: "content",
        label: "正文（注入 Agent）",
        type: "textarea",
        rows: 10,
        rules: [{ required: true, message: "请输入内容" }],
        placeholder: "将注入到提示词中的完整内容…",
      },
    },
    {
      title: "标签",
      dataIndex: "tags",
      key: "tags",
      width: 160,
      editor: {
        name: "tags",
        label: "标签（逗号分隔）",
        type: "input",
        placeholder: "项目, 规则, 上下文",
      },
      render: (tags: string[]) =>
        tags?.length ? (
          <>
            {tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </>
        ) : (
          "—"
        ),
    },
    {
      title: "公开路径",
      dataIndex: "slug",
      key: "slug",
      hideInTable: true,
      editor: {
        name: "slug",
        label: "公开 slug（可选）",
        type: "input",
        placeholder: "留空则按标题生成",
      },
    },
    {
      title: "更新",
      dataIndex: "updated",
      key: "updated",
      width: 150,
      render: (_: unknown, record) => formatTime(entryTimeMs(record)),
    },
  ];

  return (
    <>
      <CabinX
        api={api}
        columns={columns}
        pageTitle="知识库"
        rowKey="id"
        formatRecordForEdit={formatRecordForEdit}
        beforeSubmit={beforeSubmit}
        formType="D"
        editorWidth={560}
        extraHeaderActions={
          <Button
            icon={<ExportOutlined />}
            onClick={() => setPublishOpen(true)}
          >
            公开与导出
          </Button>
        }
        actionColumnRender={(record, actions) => (
          <ActionOverflow
            items={[
              {
                key: "edit",
                label: "编辑",
                onClick: () => actions.handleEdit(record),
              },
              {
                key: "delete",
                label: "删除",
                danger: true,
                onClick: () => {
                  Modal.confirm({
                    title: "删除知识",
                    content: `确定删除「${record.title}」？`,
                    okText: "删除",
                    okButtonProps: { danger: true },
                    cancelText: "取消",
                    onOk: () => actions.handleDelete(record.id),
                  });
                },
              },
            ]}
          />
        )}
      />
      <PublishSettingsModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        onDone={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
};

const PublishSettingsModal = ({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { message } = AntdApp.useApp();
  const [profile, setProfile] = useState<KnowledgeSiteProfile>({
    handle: "me",
    display_name: "ChatCMS User",
    bio: "",
  });
  const [exportDir, setExportDir] = useState(DEFAULT_EXPORT);
  const [publicCount, setPublicCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const [site, list] = await Promise.all([
          invoke<KnowledgeSiteProfile>("knowledge_site_profile_get"),
          invoke<KnowledgeEntry[]>("knowledge_list"),
        ]);
        setProfile(site);
        setPublicCount(list.filter((e) => e.visibility === "public").length);
      } catch (e) {
        message.error(String(e));
      }
    })();
  }, [open, message]);

  const saveProfile = async () => {
    setBusy("profile");
    try {
      const next = await invoke<KnowledgeSiteProfile>(
        "knowledge_site_profile_set",
        {
          handle: profile.handle,
          displayName: profile.display_name,
          bio: profile.bio,
        },
      );
      setProfile(next);
      message.success("主页资料已保存");
    } catch (e) {
      message.error(String(e));
    } finally {
      setBusy(null);
    }
  };

  const exportPublic = async () => {
    setBusy("export");
    try {
      const result = await invoke<KnowledgeExportResult>(
        "knowledge_export_public",
        { outputDir: exportDir.trim() },
      );
      message.success(`已导出 ${result.count} 条到 ${result.output_dir}`);
      onDone();
    } catch (e) {
      message.error(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title="公开与导出"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={520}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>公开主页资料</div>
          <div style={{ display: "grid", gap: 8 }}>
            <Input
              addonBefore="handle"
              value={profile.handle}
              onChange={(e) =>
                setProfile({ ...profile, handle: e.target.value })
              }
              placeholder="me"
            />
            <Input
              addonBefore="显示名"
              value={profile.display_name}
              onChange={(e) =>
                setProfile({ ...profile, display_name: e.target.value })
              }
            />
            <Input
              addonBefore="简介"
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="一句话简介"
            />
            <Button
              onClick={() => void saveProfile()}
              loading={busy === "profile"}
            >
              保存资料
            </Button>
          </div>
        </div>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            导出公开条目（当前 {publicCount} 条）
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <Input
              value={exportDir}
              onChange={(e) => setExportDir(e.target.value)}
              placeholder={DEFAULT_EXPORT}
            />
            <Button
              type="primary"
              disabled={publicCount === 0}
              loading={busy === "export"}
              onClick={() => void exportPublic()}
            >
              发布到站点
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
