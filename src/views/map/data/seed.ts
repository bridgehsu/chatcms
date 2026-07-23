import type { BusinessMapState, MapDeadline } from "../types";

const id = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** 业务地图默认数据（ChatCMS 语境） */
export const createSeedState = (): BusinessMapState => ({
  note: "",
  favorites: [
    {
      id: id(),
      title: "智能会话",
      desc: "打开主对话工作台",
      mark: "聊",
      url: "#/chat",
      tone: "red",
    },
    {
      id: id(),
      title: "模型配置",
      desc: "管理 Provider 与密钥",
      mark: "模",
      url: "#/models",
      tone: "teal",
    },
    {
      id: id(),
      title: "MCP 管理",
      desc: "接入外部工具服务",
      mark: "M",
      url: "#/mcp",
      tone: "blue",
    },
  ],
  sections: [
    {
      id: "content",
      title: "内容生产",
      icon: "✎",
      locked: false,
      collapsed: false,
      links: [
        {
          id: id(),
          title: "图文稿库",
          desc: "选题、大纲与成稿沉淀",
          mark: "文",
          url: "#/images",
          tone: "amber",
        },
        {
          id: id(),
          title: "图片素材",
          desc: "封面与配图资源池",
          mark: "图",
          url: "#/images",
          tone: "violet",
        },
        {
          id: id(),
          title: "视频素材",
          desc: "成片与切片管理",
          mark: "视",
          url: "#/videos",
          tone: "blue",
        },
        {
          id: id(),
          title: "知识记忆",
          desc: "写入 Agent 可检索知识",
          mark: "记",
          tone: "teal",
        },
      ],
    },
    {
      id: "accounts",
      title: "账号与渠道",
      icon: "◎",
      locked: false,
      collapsed: false,
      links: [
        {
          id: id(),
          title: "账号管理",
          desc: "多平台账号与权限",
          mark: "账",
          url: "#/accounts",
          tone: "red",
        },
        {
          id: id(),
          title: "渠道推送",
          desc: "Telegram 等外发通道",
          mark: "渠",
          tone: "blue",
        },
        {
          id: id(),
          title: "代理节点",
          desc: "多 Agent 角色与白名单",
          mark: "代",
          url: "#/agents",
          tone: "slate",
        },
      ],
    },
    {
      id: "automation",
      title: "自动化与技能",
      icon: "⚡",
      locked: false,
      collapsed: false,
      links: [
        {
          id: id(),
          title: "任务调度",
          desc: "项目与节点工作流",
          mark: "调",
          url: "#/schedules",
          tone: "amber",
        },
        {
          id: id(),
          title: "技能管理",
          desc: "OpenClaw 风格 SKILL.md",
          mark: "技",
          url: "#/skills",
          tone: "violet",
        },
        {
          id: id(),
          title: "MCP 工具",
          desc: "扩展 Agent 能力边界",
          mark: "工",
          url: "#/mcp",
          tone: "teal",
        },
      ],
    },
  ],
  metrics: [
    { id: "s1", label: "今日会话", value: "12", change: "+3", trend: "up" },
    { id: "s2", label: "工具调用", value: "48", change: "+12%", trend: "up" },
    { id: "s3", label: "MCP 在线", value: "2", change: "0", trend: "flat" },
    { id: "s4", label: "待审内容", value: "5", change: "-2", trend: "down" },
    { id: "s5", label: "任务调度", value: "3", change: "+1", trend: "up" },
  ],
});

/** 示例里程碑（相对今天） */
export const buildDeadlines = (now = new Date()): MapDeadline[] => {
  const year = now.getFullYear();
  const end = new Date(year, 11, 31);
  const msDay = 86400000;
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msDay));
  const weeksLeft = Math.ceil(daysLeft / 7);

  const holiday = (month: number, day: number, label: string): MapDeadline => {
    let target = new Date(year, month - 1, day);
    if (target.getTime() < now.getTime()) {
      target = new Date(year + 1, month - 1, day);
    }
    return {
      id: label,
      label,
      days: Math.max(0, Math.ceil((target.getTime() - now.getTime()) / msDay)),
    };
  };

  return [
    {
      id: "year",
      label: `${year} 年剩 ${weeksLeft} 周 · 距年底 ${daysLeft} 天`,
      days: daysLeft,
    },
    holiday(10, 1, "国庆"),
    holiday(12, 25, "圣诞"),
    holiday(1, 1, "元旦"),
    holiday(2, 14, "春节窗口"),
    holiday(5, 1, "劳动节"),
  ];
};
