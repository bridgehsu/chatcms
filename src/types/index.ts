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

export interface PermissionRequest {
  request_id: string;
  session_id: string;
  tool_name: string;
  input: Record<string, unknown>;
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
}

// ── Channels ──────────────────────────────────────────────────────────────────

export interface TelegramStatus {
  token: string;
  allowed_ids: string[];
  running: boolean;
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
  created_at: number;
  updated_at: number;
}

