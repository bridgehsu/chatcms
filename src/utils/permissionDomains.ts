import type { DomainPolicy, PermissionDomainId } from "@/types";

export type PermissionDomainMeta = {
  id: PermissionDomainId;
  label: string;
  /** 面向用户的短说明 */
  tip: string;
  /** 对应工具 / 能力提示（权限模式编辑用） */
  toolHint: string;
};

/** 权限域目录（代理覆盖 / 权限模式共用） */
export const PERMISSION_DOMAINS: PermissionDomainMeta[] = [
  {
    id: "file_read",
    label: "文件读取",
    tip: "读取工作区文件",
    toolHint: "read_file",
  },
  {
    id: "file_write",
    label: "文件写入",
    tip: "创建 / 修改文件",
    toolHint: "write_file",
  },
  { id: "shell", label: "终端", tip: "执行命令", toolHint: "bash" },
  { id: "mcp", label: "MCP", tip: "外部 MCP 工具", toolHint: "外部工具" },
  {
    id: "agent",
    label: "子代理",
    tip: "spawn 其他代理",
    toolHint: "spawn_agent",
  },
  { id: "network", label: "网络", tip: "出站请求", toolHint: "预留" },
  { id: "browser", label: "浏览器", tip: "浏览器自动化", toolHint: "预留" },
  { id: "app", label: "应用", tip: "系统应用调用", toolHint: "预留" },
];

export const DOMAIN_POLICIES: DomainPolicy[] = ["allow", "ask", "deny"];

export const DOMAIN_POLICY_LABEL: Record<DomainPolicy, string> = {
  allow: "允许",
  ask: "询问",
  deny: "拒绝",
};

export const DOMAIN_POLICY_SHORT: Record<DomainPolicy, string> = {
  allow: "允",
  ask: "询",
  deny: "拒",
};

/** 新建权限模式时的默认域策略 */
export const defaultDomainPolicies = (): Record<string, DomainPolicy> => ({
  file_read: "allow",
  file_write: "ask",
  shell: "ask",
  mcp: "ask",
  agent: "ask",
  network: "deny",
  browser: "deny",
  app: "deny",
});
