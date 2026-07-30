export type Role = "user" | "assistant" | "system" | "tool";

export interface Message {
  id: string;
  role: Role;
  content: string;
  created_at: number;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  created_at: number;
  updated_at: number;
  pinned?: boolean;
}

export interface SessionSummary {
  id: string;
  title: string;
  updated_at: number;
  message_count: number;
  pinned?: boolean;
}

export interface StreamChunk {
  session_id: string;
  delta: string;
  done: boolean;
}

export interface ToolCallEvent {
  session_id: string;
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultEvent {
  session_id: string;
  id: string;
  content: string;
  is_error: boolean;
}

export type RunMode = "observe" | "assist" | "trust";

export type DomainPolicy = "allow" | "ask" | "deny";

export type RememberScope = "once" | "session_allow" | "session_deny";

export type AuditDecision =
  | "allow_auto"
  | "allow_user"
  | "deny_user"
  | "deny_policy"
  | "deny_timeout"
  | "deny_constraint";

export type PermissionDomainId =
  | "file_read"
  | "file_write"
  | "shell"
  | "mcp"
  | "agent"
  | "network"
  | "browser"
  | "app";

export interface PermissionRequest {
  request_id: string;
  session_id: string;
  tool_name: string;
  domain: string;
  domain_label: string;
  input: Record<string, unknown>;
  input_summary: string;
}

export interface PermissionMode {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  domains: Record<string, DomainPolicy>;
}

export interface PermissionConfig {
  modes: PermissionMode[];
  active_mode_id: string;
  /** @deprecated 兼容旧配置 */
  run_mode?: RunMode;
  /** @deprecated 兼容旧配置 */
  domains?: Record<string, DomainPolicy>;
  mcp_servers: Record<string, DomainPolicy>;
  write_path_allowlist: string[];
  shell_command_deny: string[];
}

export interface DomainInfo {
  id: string;
  label: string;
  policy: DomainPolicy;
}

export interface AuditEvent {
  id: string;
  ts: number;
  session_id: string;
  agent_id: string | null;
  domain: string;
  tool_name: string;
  input_summary: string;
  decision: AuditDecision;
  run_mode?: RunMode;
  mode_name?: string;
  grant_used: boolean;
}

export type ProviderKind = "anthropic" | "openai";

// ── MCP ───────────────────────────────────────────────────────────────────────

export interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string | null;
  description?: string;
  enabled?: boolean;
}

export type McpStatus =
  | { state: "disconnected" }
  | { state: "connected"; tools: number }
  | { state: "error"; message: string };

export interface McpServerInfo {
  name: string;
  config: McpServerConfig;
  status: McpStatus;
}

export interface McpToolDef {
  server: string;
  name: string;
  api_name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// ── Knowledge ─────────────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  created_at: number;
  /** private | public */
  visibility?: string;
  /** note | doc | faq */
  kind?: string;
  slug?: string;
  updated_at?: number;
}

export interface KnowledgeSiteProfile {
  handle: string;
  display_name: string;
  bio: string;
}

export interface KnowledgeExportResult {
  handle: string;
  output_dir: string;
  count: number;
  feed_path: string;
}

// ── Channels ──────────────────────────────────────────────────────────────────

export type ChannelKind =
  | "telegram"
  | "discord"
  | "whatsapp"
  | "feishu"
  | "wechat"
  | "dingtalk";

export type ChannelStatus =
  | "idle"
  | "ready"
  | "running"
  | "coming_soon";

export interface ChannelInfo {
  kind: ChannelKind | string;
  label: string;
  description: string;
  supported: boolean;
  configured: boolean;
  enabled: boolean;
  status: ChannelStatus | string;
}

export interface ChannelDetail {
  kind: string;
  token?: string;
  allowed_ids?: string[];
  webhook?: string;
  notes?: string;
  enabled?: boolean;
}

/** @deprecated 使用 ChannelInfo / channel_get */
export interface TelegramStatus {
  token: string;
  allowed_ids: string[];
  running: boolean;
  enabled?: boolean;
}

// ── Sub-agent events ──────────────────────────────────────────────────────────

export interface SubAgentStart {
  parent_session_id: string;
  task_id: string;
  prompt: string;
}

export interface SubAgentDone {
  parent_session_id: string;
  task_id: string;
}

export interface ProviderConfig {
  kind: ProviderKind;
  api_key: string;
  model: string;
  base_url: string | null;
}

export interface ProviderProfile {
  id: string;
  name: string;
  kind: ProviderKind;
  api_key: string;
  model: string;
  base_url: string | null;
  active: boolean;
}

export interface AppConfig {
  provider: ProviderConfig;
  profiles?: ProviderProfile[];
  active_profile_id?: string | null;
}

// ── Platform accounts ─────────────────────────────────────────────────────────

export interface PlatformAccount {
  id: string;
  name: string;
  platform: string;
  account_id: string;
  access_key: string;
  secret_key: string;
  enabled: boolean;
  notes: string;
  updated_at: number;
}

// ── Media platforms / publish scripts ─────────────────────────────────────────

export type MediaPublishKind = "dynamic" | "article" | "video";

export interface MediaPlatform {
  id: string;
  code: string;
  name: string;
  kind: MediaPublishKind | string;
  inject_url: string;
  home_url: string;
  enabled: boolean;
  notes: string;
  updated_at: number;
}

export interface MediaPlatformPageItem extends MediaPlatform {
  script_is_published: boolean;
  script_has_unpublished_draft: boolean;
  script_published_version: number;
  collect_script_is_published: boolean;
  collect_script_has_unpublished_draft: boolean;
  collect_script_published_version: number;
}

export interface MediaPlatformPage {
  items: MediaPlatformPageItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface PublishScriptView {
  id: string;
  platform_id: string;
  kind: string;
  draft_script: string;
  published_script: string;
  published_version: number;
  match_url: string;
  changelog: string;
  updated_at: number;
  has_unpublished_draft: boolean;
  is_published: boolean;
}

// ── Nav bookmarks ─────────────────────────────────────────────────────────────

export interface NavBookmark {
  id: string;
  title: string;
  url: string;
  note: string;
  sort_order: number;
  updated_at: number;
}

// ── Schedule / workflow ───────────────────────────────────────────────────────

export type WorkflowNodeType =
  | "trigger"
  | "agent"
  | "http"
  | "publish"
  | "condition"
  | "delay"
  | "note";

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType | string;
  label: string;
  x: number;
  y: number;
  data: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  source_handle?: string | null;
  target_handle?: string | null;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ScheduleProject {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  workflow: WorkflowGraph;
  updated_at: number;
  created_at: number;
}

// ── Skills (OpenClaw SKILL.md) ─────────────────────────────────────────────────

export type SkillSource = "bundled" | "workspace" | "managed";

export interface Skill {
  id: string;
  name: string;
  description: string;
  body: string;
  source: SkillSource;
  enabled: boolean;
  user_invocable: boolean;
  disable_model_invocation: boolean;
  homepage: string | null;
  metadata: Record<string, unknown> | null;
  created_at: number;
  updated_at: number;
}

// ── Agent profiles ────────────────────────────────────────────────────────────

export interface AgentProfile {
  id: string;
  slug: string;
  name: string;
  description: string;
  system_prompt: string;
  emoji: string;
  enabled: boolean;
  is_default: boolean;
  /** null = 全部技能；[] = 无；string[] = 白名单 */
  skills: string[] | null;
  allow_as_subagent: boolean;
  /** 域 id → 策略；空对象 = 继承全局 */
  permission_overrides: Record<string, DomainPolicy>;
  created_at: number;
  updated_at: number;
}

