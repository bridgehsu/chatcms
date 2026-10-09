import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Switch,
  Tag,
  Tooltip,
} from "antd";
import { EyeOutlined, StarFilled, StarOutlined } from "@ant-design/icons";
import { invoke } from "@/hooks/useTauri";
import type { AgentProfile, Skill } from "@/types";
import CabinX, { type CabinXColumn, type FormField } from "@/components/CabinX";
import Editor from "@/components/CabinX/Editor";
import FormSec from "@/components/FormSec";
import {
  configToSkills,
  skillsToConfig,
  type SkillsConfig,
} from "@/utils/agentSkills";
import { formatTime } from "@/utils/time";
import SkillsField from "./components/SkillsField";
import PermField from "./components/PermField";

export const AgentsPage = () => {
  const [skillOptions, setSkillOptions] = useState<Skill[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [viewForm] = Form.useForm();
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTitle, setViewTitle] = useState("");

  const refreshMeta = async () => {
    const [skills, activeId] = await Promise.all([
      invoke<Skill[]>("skill_list"),
      invoke<string | null>("agent_active_id"),
    ]);
    setSkillOptions(skills);
    setActiveAgentId(activeId);
  };

  useEffect(() => {
    void refreshMeta().catch(console.error);
  }, [refreshKey]);

  const handleActivate = async (id: string) => {
    await invoke("agent_activate", { id });
    setRefreshKey((k) => k + 1);
  };

  const api = useMemo(
    () => ({
      paging: async (params: any) => {
        void refreshKey;
        let list = await invoke<AgentProfile[]>("agent_list");
        if (params?.name?.trim()) {
          const q = params.name.trim().toLowerCase();
          list = list.filter((a) => a.name.toLowerCase().includes(q));
        }
        return {
          list,
          total: list.length,
          pageNum: 1,
          pageSize: Math.max(list.length, 10),
        };
      },
      add: async (data: any) => invoke("agent_add", data),
      edit: async (data: any) => {
        const { id, ...rest } = data;
        return invoke("agent_update", { id, ...rest });
      },
      del: async (id: string | number) =>
        invoke("agent_remove", { id: String(id) }),
    }),
    [refreshKey],
  );

  const formatRecordForEdit = (record: AgentProfile) => ({
    name: record.name,
    slug: record.slug,
    remark: record.remark,
    system_prompt: record.system_prompt,
    enabled: record.enabled,
    spawnable: record.spawnable,
    sort: record.sort,
    skillsConfig: skillsToConfig(record.skills),
    permOverrides: { ...(record.perms ?? {}) },
    workspace_dir: record.workspace_dir ?? "",
  });

  const beforeSubmit = (values: any) => {
    const { skillsConfig, permOverrides, workspace_dir: _ws, ...rest } = values;
    return {
      ...rest,
      skills: configToSkills(skillsConfig as SkillsConfig | undefined),
      perms: permOverrides ?? {},
    };
  };

  const columns: CabinXColumn<AgentProfile>[] = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      fixed: "left",
      search: {
        name: "name",
        label: "代理名称",
        type: "input",
        placeholder: "搜索代理名称",
      },
      render: (name: string, record: AgentProfile) => (
        <span className="agent-table__name">
          <span className="agent-table__avatar" aria-hidden>
            {(name || "?").slice(0, 1)}
          </span>
          <span>{name}</span>
          {record.id === activeAgentId ? (
            <Tag color="gold" className="agent-table__tag">
              默认
            </Tag>
          ) : null}
        </span>
      ),
    },
    {
      title: "短标识",
      dataIndex: "slug",
      key: "slug",
      render: (slug: string) => (
        <span className="agent-table__mono">{slug}</span>
      ),
    },

    // ── 表单：基础信息 ──────────────────────────────────────────────
    {
      title: "",
      dataIndex: "__sec_basic",
      key: "__sec_basic",
      hideInTable: true,
      editor: {
        name: "__sec_basic",
        type: "input",
        renderFormItem: () => (
          <FormSec
            title="基础信息"
            hint="名称用于展示，短标识用于工作区目录与内部引用"
          />
        ),
      },
    },
    {
      title: "",
      dataIndex: "__identity",
      key: "__identity",
      hideInTable: true,
      editor: {
        name: "__identity",
        type: "input",
        renderFormItem: () => (
          <div className="agent-form__block">
            <Row gutter={[14, 0]}>
              <Col span={14}>
                <Form.Item
                  name="name"
                  label="代理名称"
                  rules={[{ required: true, message: "请输入代理名称" }]}
                >
                  <Input placeholder="如：内容写手" maxLength={40} showCount />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item
                  name="slug"
                  label="短标识"
                  rules={[
                    { required: true, message: "请输入短标识" },
                    {
                      pattern: /^[a-z0-9][a-z0-9_-]{0,31}$/,
                      message: "仅小写字母、数字、连字符与下划线",
                    },
                  ]}
                >
                  <Input placeholder="writer" maxLength={32} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="remark" label="简介">
              <Input.TextArea
                rows={2}
                placeholder="一句话说明职责，显示在会话角色选择器中"
                maxLength={120}
                showCount
              />
            </Form.Item>
            <div className="agent-form__switches">
              <Form.Item
                name="enabled"
                label="启用"
                valuePropName="checked"
                initialValue={true}
                className="agent-form__switch-item"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
              <Form.Item
                name="spawnable"
                label="可作子代理"
                valuePropName="checked"
                initialValue={true}
                className="agent-form__switch-item"
              >
                <Switch checkedChildren="允许" unCheckedChildren="禁止" />
              </Form.Item>
              <Form.Item
                name="sort"
                label="排序"
                initialValue={0}
                className="agent-form__switch-item agent-form__switch-item--sort"
              >
                <InputNumber min={0} placeholder="越小越前" style={{ width: "100%" }} />
              </Form.Item>
            </div>
          </div>
        ),
      },
    },

    // ── 表单：角色设定 ──────────────────────────────────────────────
    {
      title: "",
      dataIndex: "__sec_persona",
      key: "__sec_persona",
      hideInTable: true,
      editor: {
        name: "__sec_persona",
        type: "input",
        renderFormItem: () => (
          <FormSec
            title="角色设定"
            hint="系统提示会注入该代理的每一轮对话，建议写清职责、边界与输出风格"
          />
        ),
      },
    },
    {
      title: "系统提示",
      dataIndex: "system_prompt",
      key: "system_prompt",
      hideInTable: true,
      editor: {
        name: "system_prompt",
        type: "input",
        renderFormItem: () => (
          <div className="agent-form__block">
            <Form.Item name="system_prompt" className="agent-form__prompt-item">
              <Input.TextArea
                rows={8}
                className="agent-form__prompt"
                placeholder={
                  "你是一位专业的内容写手。\n职责：根据选题产出小红书种草文案。\n风格：口语化、有场景感，结尾给行动号召。"
                }
              />
            </Form.Item>
          </div>
        ),
      },
    },

    // ── 表单：技能 ──────────────────────────────────────────────────
    {
      title: "",
      dataIndex: "__sec_skills",
      key: "__sec_skills",
      hideInTable: true,
      editor: {
        name: "__sec_skills",
        type: "input",
        renderFormItem: () => (
          <FormSec
            title="技能配置"
            hint="控制该代理可调用哪些 Skill（SKILL.md）"
          />
        ),
      },
    },
    {
      title: "技能",
      dataIndex: "skills",
      key: "skills",
      render: (skills: string[] | null) => {
        if (skills === null) return "全部";
        if (skills.length === 0) return "无";
        return skills.join(", ");
      },
      editor: {
        name: "skillsConfig",
        type: "input",
        initialValue: { mode: "all", skills: [] } as SkillsConfig,
        renderFormItem: () => (
          <div className="agent-form__block">
            <Form.Item
              name="skillsConfig"
              initialValue={{ mode: "all", skills: [] } as SkillsConfig}
              className="agent-form__bare-item"
            >
              <SkillsField skillOptions={skillOptions} />
            </Form.Item>
          </div>
        ),
      },
    },

    // ── 表单：权限 ──────────────────────────────────────────────────
    {
      title: "",
      dataIndex: "__sec_perms",
      key: "__sec_perms",
      hideInTable: true,
      editor: {
        name: "__sec_perms",
        type: "input",
        renderFormItem: () => (
          <FormSec
            title="权限覆盖"
            hint="按域覆盖全局权限模式；留空则继承当前激活的权限策略"
          />
        ),
      },
    },
    {
      title: "权限覆盖",
      dataIndex: "perms",
      key: "perms",
      hideInTable: true,
      editor: {
        name: "permOverrides",
        type: "input",
        initialValue: {},
        renderFormItem: () => (
          <div className="agent-form__block">
            <Form.Item
              name="permOverrides"
              initialValue={{}}
              className="agent-form__bare-item"
            >
              <PermField />
            </Form.Item>
          </div>
        ),
      },
    },

    // ── 表单：工作空间（仅查看）────────────────────────────────────
    {
      title: "工作空间",
      dataIndex: "workspace_dir",
      key: "workspace_dir",
      hideInTable: true,
      editor: {
        name: "workspace_dir",
        type: "input",
        hide: [true, true, false],
        renderFormItem: (form: any) => {
          const dir = form.getFieldValue("workspace_dir");
          return (
            <>
              <FormSec
                title="工作空间"
                hint="每个代理独占一个本机目录，会话绑定后路径不变"
              />
              <div className="agent-form__block">
                <div className="agent-form__workspace">
                  <code>{dir || "保存后自动生成"}</code>
                </div>
              </div>
            </>
          );
        },
      },
    },

    {
      title: "可被调用",
      dataIndex: "spawnable",
      key: "spawnable",
      render: (v: boolean) => (v ? "允许" : "禁止"),
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      render: (enabled: boolean, record: AgentProfile) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={async (checked) => {
            await invoke("agent_update", { id: record.id, enabled: checked });
            setRefreshKey((k) => k + 1);
          }}
        />
      ),
    },
    {
      title: "更新",
      dataIndex: "updated",
      key: "updated",
      render: (ms: number) => formatTime(ms),
    },
  ];

  const editorFormFields = useMemo<FormField[]>(
    () =>
      columns
        .filter((col) => col.editor && typeof col.editor === "object")
        .map((col) => {
          const editor = col.editor as FormField;
          return {
            ...editor,
            name: editor.name ?? (col.dataIndex as string),
            label: editor.label ?? (col.title as string),
          };
        })
        .filter((f) => !f.hide?.[2]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [skillOptions, activeAgentId],
  );

  const handleView = (record: AgentProfile) => {
    setViewTitle(record.name);
    viewForm.setFieldsValue(formatRecordForEdit(record));
    setViewOpen(true);
  };

  return (
    <div className="page page-scroll">
      <CabinX
        api={api}
        columns={columns}
        pageTitle="代理管理"
        rowKey="id"
        formatRecordForEdit={formatRecordForEdit}
        beforeSubmit={beforeSubmit}
        formType="D"
        editorWidth={720}
        editorTitle="代理"
        actionBtnComponents={(record: AgentProfile) => (
          <>
            <Tooltip
              title={
                record.id === activeAgentId
                  ? "当前全局默认"
                  : "设为全局默认"
              }
            >
              <Button
                type="link"
                icon={
                  record.id === activeAgentId ? (
                    <StarFilled />
                  ) : (
                    <StarOutlined />
                  )
                }
                disabled={!record.enabled || record.id === activeAgentId}
                onClick={() => void handleActivate(record.id)}
              >
                {record.id === activeAgentId ? "默认" : "设为默认"}
              </Button>
            </Tooltip>
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              查看
            </Button>
          </>
        )}
      />

      <Editor
        title={viewTitle}
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        onSubmit={async () => {}}
        formFields={editorFormFields}
        loading={false}
        form={viewForm}
        type="D"
        width={720}
        readOnly
      />
    </div>
  );
};
