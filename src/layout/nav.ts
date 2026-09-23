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
  IconIntent,
  IconEval,
  IconObserve,
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
    kind: "group",
    id: "workbench",
    label: "工作台",
    Icon: IconChat,
    defaultPath: "/chat",
    children: [
      {
        path: "/chat",
        label: "智能会话",
        description: "Ask / Agent / Search：问答、工具干活与知识检索",
        Icon: IconChat,
      },
      {
        path: "/map",
        label: "业务地图",
        description: "分区入口、笔记与截止提醒，一览业务全貌",
        Icon: IconMap,
      },
      {
        path: "/content",
        label: "内容管理",
        description: "Notion 风格 AI 笔记，沉淀选题与成稿",
        Icon: IconContent,
      },
      {
        path: "/images",
        label: "图片工厂",
        description: "图片列表：上传、AI 生成与网页导入素材",
        Icon: IconImages,
      },
      {
        path: "/videos",
        label: "视频工厂",
        description: "视频列表：上传、AI 生成与网页导入成片",
        Icon: IconVideos,
      },
      {
        path: "/schedules",
        label: "调度中心",
        description: "创建调度项目，在画布中设计节点工作流（类似 n8n）",
        Icon: IconCron,
      },
    ],
  },
  {
    kind: "group",
    id: "media-ops",
    label: "媒体管理",
    Icon: IconMedia,
    defaultPath: "/crawler",
    children: [
      {
        path: "/crawler",
        label: "媒体采集",
        description: "连接 chatcms-collect：启停任务、日志与数据文件",
        Icon: IconCrawler,
      },
      {
        path: "/media-platforms",
        label: "插件脚本",
        description: "各平台发布/采集注入页与 JS 脚本（浏览器插件）",
        Icon: IconMedia,
      },
      {
        path: "/accounts",
        label: "账号管理",
        description: "本机平台账号与密钥，主密码保险柜保护",
        Icon: IconAccounts,
      },
    ],
  },
  {
    kind: "group",
    id: "workspace",
    label: "智能配置",
    Icon: IconAgents,
    defaultPath: "/agents",
    children: [
      {
        path: "/agents",
        label: "代理管理",
        description: "管理多角色档案、全局默认与技能白名单；会话可选手选主 Agent",
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
      {
        path: "/intents",
        label: "意图规则",
        description: "配置会话意图关键词与权重（软路由；Agent 模式按意图选角色）",
        Icon: IconIntent,
      },
      {
        path: "/settings/knowledge",
        label: "知识库",
        description: "本机知识条目；Search 模式优先检索；亦可注入 Agent",
        Icon: IconMemory,
      },
    ],
  },
  {
    kind: "group",
    id: "settings",
    label: "系统设置",
    Icon: IconSettings,
    defaultPath: "/settings/general",
    children: [
      {
        path: "/settings/general",
        label: "全局配置",
        description: "存储根目录、视频/采集服务地址与发布桥端口",
        Icon: IconSettings,
      },
      {
        path: "/settings/permissions",
        label: "权限管理",
        description: "自定义权限模式，控制工具调用的授权策略",
        Icon: IconLock,
      },
      {
        path: "/settings/eval",
        label: "意图评测",
        description: "意图规则离线 case 批跑，查看准确率与失败样例",
        Icon: IconEval,
      },
      {
        path: "/settings/observability",
        label: "运行观测",
        description: "会话链路（含 Ask/Agent/Search）与工具权限审计",
        Icon: IconObserve,
      },
      {
        path: "/settings/channels",
        label: "渠道列表",
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
  if (pathname === "/videos/generate" || pathname === "/videos/studio") return "制片";
  if (pathname === "/crawler/new") return "新增媒体采集";
  if (pathname.match(/^\/crawler\/[^/]+$/)) return "媒体采集";
  if (pathname.match(/^\/media-platforms\/[^/]+\/collect-script$/))
    return "采集脚本";
  if (pathname.match(/^\/media-platforms\/[^/]+\/script$/)) return "填表脚本";
  return leafForPath(pathname)?.label ?? "ChatCMS";
};

/** 顶部标题下方的页面说明（产品页统一不展示二级标题） */
export const subtitleForPath = (_pathname: string): string | undefined =>
  undefined;


/** 当前路径是否属于某分组 */
export const groupContainsPath = (group: NavGroup, pathname: string): boolean =>
  group.children.some(
    (c) => pathname === c.path || pathname.startsWith(`${c.path}/`),
  );
