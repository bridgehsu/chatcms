/** 常用 MCP stdio 服务器预设（对齐 OpenClaw / Anthropic 生态） */

export type McpPreset = {
  id: string;
  label: string;
  description: string;
  name: string;
  command: string;
  args: string;
  env?: string;
  cwd?: string;
};

export const MCP_PRESETS: McpPreset[] = [
  {
    id: "filesystem",
    label: "Filesystem",
    description: "读写本地目录（请改成你的路径）",
    name: "filesystem",
    command: "npx",
    args: "-y @modelcontextprotocol/server-filesystem /tmp",
  },
  {
    id: "fetch",
    label: "Fetch",
    description: "抓取网页与 HTTP 内容",
    name: "fetch",
    command: "npx",
    args: "-y @modelcontextprotocol/server-fetch",
  },
  {
    id: "memory",
    label: "Memory",
    description: "轻量知识图谱记忆",
    name: "memory",
    command: "npx",
    args: "-y @modelcontextprotocol/server-memory",
  },
  {
    id: "github",
    label: "GitHub",
    description: "仓库 / Issue / PR（需 Token）",
    name: "github",
    command: "npx",
    args: "-y @modelcontextprotocol/server-github",
    env: "GITHUB_PERSONAL_ACCESS_TOKEN=",
  },
  {
    id: "sqlite",
    label: "SQLite",
    description: "查询本地 SQLite 数据库",
    name: "sqlite",
    command: "uvx",
    args: "mcp-server-sqlite --db-path ./data.db",
  },
  {
    id: "sequential",
    label: "Sequential Thinking",
    description: "分步推理辅助",
    name: "sequential-thinking",
    command: "npx",
    args: "-y @modelcontextprotocol/server-sequential-thinking",
  },
];
