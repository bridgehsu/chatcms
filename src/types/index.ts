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
}

export interface SessionSummary {
  id: string;
  title: string;
  updated_at: number;
  message_count: number;
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

