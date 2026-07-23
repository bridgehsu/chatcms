import type { ComponentType } from "react";
import {
  IconAccounts,
  IconAgents,
  IconChat,
  IconCron,
  IconImages,
  IconMap,
  IconMcp,
  IconSettings,
  IconSkills,
  IconVideos,
} from "@/components/icons";

/** 一级导航（平铺，无二级） */
export type NavItem = {
  path: string;
  label: string;
  Icon: ComponentType;
  /** 视觉分隔：该项之前画一条线 */
  dividerBefore?: boolean;
};

/** 主列表（设置单独贴底） */
export const NAV_ITEMS: NavItem[] = [
  { path: "/chat", label: "智能会话", Icon: IconChat },
  { path: "/map", label: "业务地图", Icon: IconMap },
  { path: "/images", label: "图片管理", Icon: IconImages },
  { path: "/videos", label: "视频管理", Icon: IconVideos },
  { path: "/accounts", label: "账号管理", Icon: IconAccounts },
  { path: "/cron", label: "定时任务", Icon: IconCron, dividerBefore: true },
  { path: "/skills", label: "技能管理", Icon: IconSkills, dividerBefore: true },
  { path: "/agents", label: "代理管理", Icon: IconAgents },
  { path: "/mcp", label: "MCP 管理", Icon: IconMcp },
];

export const SETTINGS_ITEM = {
  label: "设置",
  Icon: IconSettings,
} as const;

export const titleForPath = (pathname: string): string => {
  const item = NAV_ITEMS.find(
    (n) => pathname === n.path || pathname.startsWith(`${n.path}/`),
  );
  return item?.label ?? "ChatCMS";
};
