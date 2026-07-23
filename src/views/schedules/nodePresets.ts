import type { WorkflowNodeType } from "@/types";

export type NodePreset = {
  type: WorkflowNodeType;
  label: string;
  description: string;
  color: string;
  defaultData: Record<string, unknown>;
};

export const NODE_PRESETS: NodePreset[] = [
  {
    type: "trigger",
    label: "触发器",
    description: "定时 / 手动启动流程",
    color: "var(--wf-trigger)",
    defaultData: { mode: "cron", cron: "0 9 * * *", note: "" },
  },
  {
    type: "agent",
    label: "Agent",
    description: "调用智能会话生成内容",
    color: "var(--wf-agent)",
    defaultData: { prompt: "", model: "" },
  },
  {
    type: "http",
    label: "HTTP",
    description: "请求外部 API",
    color: "var(--wf-http)",
    defaultData: { method: "POST", url: "", body: "" },
  },
  {
    type: "publish",
    label: "平台发布",
    description: "发布到绑定的内容账号",
    color: "var(--wf-publish)",
    defaultData: { platform: "", accountId: "", content: "" },
  },
  {
    type: "condition",
    label: "条件",
    description: "按表达式分支",
    color: "var(--wf-condition)",
    defaultData: { expression: "" },
  },
  {
    type: "delay",
    label: "延时",
    description: "等待一段时间再继续",
    color: "var(--wf-delay)",
    defaultData: { seconds: 60 },
  },
  {
    type: "note",
    label: "备注",
    description: "画布说明节点",
    color: "var(--wf-note)",
    defaultData: { text: "" },
  },
];

export const getNodePreset = (type: string): NodePreset =>
  NODE_PRESETS.find((p) => p.type === type) ?? NODE_PRESETS[NODE_PRESETS.length - 1];
