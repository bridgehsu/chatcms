import { useMemo, useState } from "react";
import { Button, Form, Input, Modal, Switch, Tooltip } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { invoke } from "@/hooks/useTauri";
import type { ScriptPackage, ScriptPackageDetail, ScriptPackagePage } from "@/types";
import CabinX, { ActionOverflow, type CabinXColumn } from "@/components/CabinX";
import { IconPlus } from "@/components/icons";
import { formatTime } from "@/utils/time";

const NOTES_MAX = 30;

const renderNotes = (notes: string | undefined) => {
  const text = (notes ?? "").trim();
  if (!text) return <span className="model-status-idle">—</span>;
  if (text.length <= NOTES_MAX) {
    return <span className="account-table__notes">{text}</span>;
  }
  const short = `${text.slice(0, NOTES_MAX)}…`;
  return (
    <Tooltip title={text} placement="topLeft">
      <span className="account-table__notes script-pkg-notes--clip">{short}</span>
    </Tooltip>
  );
};

export const MediaPlatformsPage = () => {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<{ code: string; name: string; notes?: string }>();

  const api = useMemo(
    () => ({
      paging: async (params: any) => {
        const result = await invoke<ScriptPackagePage>("script_pkg_list_page", {
          query: params?.name?.trim() || null,
          page: params?.pageNum ?? 1,
          pageSize: params?.pageSize ?? 10,
        });
        return {
          list: result.items,
          total: result.total,
          pageNum: result.page,
          pageSize: result.page_size,
        };
      },
      del: async (id: string | number) =>
        invoke("script_pkg_remove", { id: String(id) }),
    }),
    [],
  );

  const columns: CabinXColumn<ScriptPackage>[] = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      fixed: "left",
      width: 168,
      ellipsis: true,
      search: {
        name: "name",
        label: "关键词",
        type: "input",
        placeholder: "搜索名称、编码…",
      },
      render: (name: string) => (
        <span className="model-table__name">{name}</span>
      ),
    },
    {
      title: "备注",
      dataIndex: "notes",
      key: "notes",
      width: 220,
      ellipsis: true,
      render: (notes: string) => renderNotes(notes),
    },
    {
      title: "编码",
      dataIndex: "code",
      key: "code",
      width: 168,
      ellipsis: true,
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      width: 80,
      render: (enabled: boolean, record: ScriptPackage) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={async (checked) => {
            await invoke("script_pkg_set_enabled", {
              id: record.id,
              enabled: checked,
            });
          }}
        />
      ),
    },
    {
      title: "更新",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 140,
      render: (ms: number) => formatTime(ms),
    },
  ];

  const onCreate = async () => {
    const values = await form.validateFields();
    setCreating(true);
    try {
      const detail = await invoke<ScriptPackageDetail>("script_pkg_create", {
        code: values.code.trim(),
        name: values.name.trim(),
        notes: values.notes?.trim() || null,
      });
      setCreateOpen(false);
      form.resetFields();
      navigate(`/media-platforms/${detail.package.id}/edit`);
    } catch (e) {
      Modal.error({ title: "创建失败", content: String(e) });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page page-scroll">
      <CabinX
        api={api}
        columns={columns}
        pageTitle="插件脚本"
        rowKey="id"
        showActionColumn
        actionColumnWidth={100}
        headerActions={
          <Button
            variant="outlined"
            color="primary"
            icon={<IconPlus />}
            onClick={() => setCreateOpen(true)}
          >
            新增
          </Button>
        }
        actionColumnRender={(record, actions) => (
          <ActionOverflow
            items={[
              {
                key: "edit",
                label: "编辑",
                onClick: () =>
                  navigate(`/media-platforms/${record.id}/edit`),
              },
              {
                key: "delete",
                label: "删除",
                icon: <DeleteOutlined />,
                danger: true,
                onClick: () => {
                  if (!window.confirm(`确定删除「${record.name}」？`)) return;
                  void actions.handleDelete(record.id);
                },
              },
            ]}
          />
        )}
      />

      <Modal
        title="新增脚本"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
        onOk={() => void onCreate()}
        confirmLoading={creating}
        destroyOnClose
        okText="创建"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: "请输入名称" }]}
          >
            <Input placeholder="如：BOSS直聘·打招呼" />
          </Form.Item>
          <Form.Item
            name="code"
            label="编码"
            rules={[{ required: true, message: "请输入编码" }]}
          >
            <Input placeholder="如：JOB_BOSS_GREET（自动大写）" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={5} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export { ScriptPackageEditPage } from "./ScriptPackageEditPage";
