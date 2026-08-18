import type { ComponentType } from "react";
import {
  IconAccounts,
  IconAgents,
  IconChannels,
  IconChat,
  IconContent,
  IconCron,
  IconCrawler,
  IconImages,
  IconLock,
  IconMap,
  IconMcp,
  IconMedia,
  IconMemory,
  IconProvider,
  IconSettings,
  IconSkills,
  IconVideos,
} from "@/components/icons";

export type NavIcon = ComponentType<{ locked?: boolean }>;

/** 一级叶子项 */
export type NavLeaf = {
  kind: "leaf";
  path: string;
  label: string;
  description: string;
  Icon: NavIcon;
  dividerBefore?: boolean;
};

/** 可展开分组（二级菜单） */
export type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  Icon: NavIcon;
  /** 点击父级时的默认子路径 */
  defaultPath: string;
  dividerBefore?: boolean;
  children: {
    path: string;
    label: string;
    description: string;
    Icon: NavIcon;
  }[];
};

export type NavEntry = NavLeaf | NavGroup;

/** 侧栏导航：干活区平铺 + 智能配置 / 系统设置分组 */
export const NAV_ENTRIES: NavEntry[] = [
  {
    kind: "leaf",
    path: "/map",
    label: "业务地图",
    description: "分区入口、笔记与截止提醒，一览业务全貌",
    Icon: IconMap,
  },
  {
    kind: "leaf",
    path: "/chat",
    label: "智能会话",
    description: "与 Agent 对话，调用工具与技能完成任务",
    Icon: IconChat,
  },
  {
    kind: "leaf",
    path: "/content",
    label: "内容管理",
    description: "Notion 风格 AI 笔记，沉淀选题与成稿",
    Icon: IconContent,
  },
  {
    kind: "leaf",
    path: "/images",
    label: "图片管理",
    description: "图片列表：上传、AI 生成与网页导入素材",
    Icon: IconImages,
  },
  {
    kind: "leaf",
    path: "/videos",
    label: "视频管理",
    description: "视频列表：上传、AI 生成与网页导入成片",
    Icon: IconVideos,
  },
  {
    kind: "leaf",
    path: "/crawler",
    label: "采集中心",
    description: "经 HTTP 连接 chatcms-collect：启停任务、查看日志与数据文件",
    Icon: IconCrawler,
  },
  {
    kind: "leaf",
    path: "/media-platforms",
    label: "媒体管理",
    description: "维护各平台发布/采集注入页与脚本（草稿 / 已发布）",
    Icon: IconMedia,
  },
  {
    kind: "leaf",
    path: "/accounts",
    label: "账号管理",
    description: "管理各大内容平台的账号与密钥，数据保存在本机应用目录",
    Icon: IconAccounts,
  },
  {
    kind: "leaf",
    path: "/schedules",
    label: "任务调度",
    description: "创建调度项目，在画布中设计节点工作流（类似 n8n）",
    Icon: IconCron,
    dividerBefore: true,
  },
  {
    kind: "leaf",
    path: "/settings/knowledge",
    label: "知识库",
    description: "本机知识条目；可勾选公开并导出到 chatcms.org",
    Icon: IconMemory,
  },
  {
    kind: "group",
    id: "workspace",
    label: "智能配置",
    Icon: IconAgents,
    defaultPath: "/agents",
    dividerBefore: true,
    children: [
      {
        path: "/agents",
        label: "代理管理",
        description: "管理多 Agent 档案、默认代理与技能白名单",
        Icon: IconAgents,
      },
      {
        path: "/skills",
        label: "技能管理",
        description: "管理 OpenClaw 风格技能（SKILL.md）与提示词注入",
        Icon: IconSkills,
      },
      {
        path: "/mcp",
        label: "模型协议",
        description: "接入 MCP 服务器，为 Agent 动态扩展外部工具能力",
        Icon: IconMcp,
      },
      {
        path: "/models",
        label: "模型配置",
        description: "配置模型提供商、密钥与当前激活模型",
        Icon: IconProvider,
      },
    ],
  },
  {
    kind: "group",
    id: "settings",
    label: "系统设置",
    Icon: IconSettings,
    defaultPath: "/settings/permissions",
    children: [
      {
        path: "/settings/permissions",
        label: "权限",
        description: "自定义权限模式，控制工具调用的授权策略",
        Icon: IconLock,
      },
      {
        path: "/settings/channels",
        label: "渠道",
        description: "配置 Telegram 等聊天渠道机器人，各平台可并行启用",
        Icon: IconChannels,
      },
    ],
  },
];

const allLeaves = (): { path: string; label: string; description: string }[] => {
  const out: { path: string; label: string; description: string }[] = [];
  for (const e of NAV_ENTRIES) {
    if (e.kind === "leaf") {
      out.push({ path: e.path, label: e.label, description: e.description });
    } else {
      for (const c of e.children) {
        out.push({
          path: c.path,
          label: c.label,
          description: c.description,
        });
      }
    }
  }
  return out;
};

const leafForPath = (pathname: string) => {
  const leaves = allLeaves();
  const exact = leaves.find((n) => pathname === n.path);
  if (exact) return exact;
  const prefix = leaves.find((n) => pathname.startsWith(`${n.path}/`));
  if (prefix) return prefix;
  if (pathname === "/permissions" || pathname.startsWith("/permissions/")) {
    return leaves.find((n) => n.path === "/settings/permissions");
  }
  return undefined;
};

export const titleForPath = (pathname: string): string => {
  if (pathname === "/images/generate") return "AI 生成图片";
  if (pathname === "/videos/generate") return "AI 生成视频";
  if (pathname === "/videos/studio") return "视频工程";
  if (pathname.match(/^\/media-platforms\/[^/]+\/collect-script$/))
    return "采集脚本";
  if (pathname.match(/^\/media-platforms\/[^/]+\/script$/)) return "填表脚本";
  return leafForPath(pathname)?.label ?? "ChatCMS";
};

/** 顶部标题下方的页面说明 */
export const subtitleForPath = (pathname: string): string | undefined => {
  if (pathname === "/images/generate") {
    return "填写提示词生成图片，完成后回到图片列表";
  }
  if (pathname === "/videos/generate") {
    return "填写提示词生成视频，完成后回到视频列表";
  }
  if (pathname.match(/^\/media-platforms\/[^/]+\/collect-script$/)) {
    return "编辑采集草稿并发布；扩展桥仅消费已发布采集脚本";
  }
  if (pathname.match(/^\/media-platforms\/[^/]+\/script$/)) {
    return "编辑草稿并发布；扩展桥仅消费已发布脚本";
  }
  return leafForPath(pathname)?.description;
};

/** 当前路径是否属于某分组 */
export const groupContainsPath = (group: NavGroup, pathname: string): boolean =>
  group.children.some(
    (c) => pathname === c.path || pathname.startsWith(`${c.path}/`),
  );
