import { useState } from "react";

type ToolStatus = "running" | "done" | "error";

type ParsedTool = {
  name: string;
  input: Record<string, unknown> | null;
  summary: string;
  result: string;
  status: ToolStatus;
};

const TOOL_META: Record<
  string,
  { label: string; kind: "file" | "shell" | "agent" | "generic" }
> = {
  read_file: { label: "读取文件", kind: "file" },
  write_file: { label: "写入文件", kind: "file" },
  bash: { label: "终端命令", kind: "shell" },
  spawn_agent: { label: "子代理", kind: "agent" },
};

const asRecord = (v: unknown): Record<string, unknown> | null => {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
};

const tryParseJson = (raw: string): Record<string, unknown> | null => {
  try {
    return asRecord(JSON.parse(raw.trim()));
  } catch {
    return null;
  }
};

const summarizeInput = (
  name: string,
  input: Record<string, unknown> | null,
): string => {
  if (!input) return "";
  if (name === "bash") {
    const cmd = input.command ?? input.cmd;
    return typeof cmd === "string" ? cmd : JSON.stringify(input);
  }
  if (name === "read_file" || name === "write_file") {
    const path = input.path ?? input.file_path;
    return typeof path === "string" ? path : JSON.stringify(input);
  }
  if (name === "spawn_agent") {
    const prompt = input.prompt;
    if (typeof prompt === "string") {
      return prompt.length > 120 ? `${prompt.slice(0, 120)}…` : prompt;
    }
  }
  const keys = Object.keys(input);
  if (keys.length === 1 && typeof input[keys[0]] === "string") {
    return String(input[keys[0]]);
  }
  return JSON.stringify(input);
};

/** 解析会话里的 tool 消息（兼容直播 calling 与落库 [tool:…] 两种格式）。 */
export const parseToolContent = (content: string): ParsedTool => {
  const trimmed = content.trim();
  const nl = trimmed.indexOf("\n");
  const firstLine = nl >= 0 ? trimmed.slice(0, nl) : trimmed;
  const rest = nl >= 0 ? trimmed.slice(nl + 1).trim() : "";

  // [tool: name | {...}]
  const persisted = firstLine.match(
    /^\[tool:\s*([^|\]]+?)(?:\s*\|\s*(\{.*\}))?\]\s*$/,
  );
  if (persisted) {
    const name = persisted[1].trim();
    const input = persisted[2] ? tryParseJson(persisted[2]) : null;
    let result = rest;
    const explicitError = result.startsWith("[error]");
    if (explicitError) {
      result = result.replace(/^\[error\]\s*/, "");
    }
    const denied = /user denied permission/i.test(result);
    const looksError =
      explicitError ||
      denied ||
      /no such file|not found|error|exit code|failed/i.test(result);
    return {
      name,
      input,
      summary: summarizeInput(name, input),
      result,
      status: looksError ? "error" : result ? "done" : "running",
    };
  }

  // [calling: name]\n{json}\n\n[result|error]\n...
  const calling = firstLine.match(/^\[calling:\s*([^\]]+)\]\s*$/);
  if (calling) {
    const name = calling[1].trim();
    const split = rest.split(/\n\n\[(result|error)\]\n?/);
    const inputRaw = (split[0] ?? "").trim();
    const input = tryParseJson(inputRaw);
    const flag = split[1];
    const result = (split.slice(2).join("\n\n") || "").trim();
    let status: ToolStatus = "running";
    if (flag === "error") status = "error";
    else if (flag === "result") status = "done";
    else if (result) status = "done";
    return {
      name,
      input,
      summary: summarizeInput(name, input) || inputRaw,
      result,
      status,
    };
  }

  return {
    name: "tool",
    input: null,
    summary: "",
    result: trimmed,
    status: /\[error\]|denied|no such file/i.test(trimmed) ? "error" : "done",
  };
};

const statusLabel = (s: ToolStatus) => {
  if (s === "running") return "执行中";
  if (s === "error") return "失败";
  return "完成";
};

const RESULT_PREVIEW = 8;

export const ToolMessage = ({ content }: { content: string }) => {
  const parsed = parseToolContent(content);
  const meta = TOOL_META[parsed.name] ?? {
    label: parsed.name.startsWith("mcp") ? parsed.name : `工具 · ${parsed.name}`,
    kind: "generic" as const,
  };
  const lines = parsed.result ? parsed.result.split("\n") : [];
  const long = lines.length > RESULT_PREVIEW;
  const [open, setOpen] = useState(false);
  const shown =
    long && !open
      ? `${lines.slice(0, RESULT_PREVIEW).join("\n")}\n…`
      : parsed.result;

  return (
    <div
      className={`tool-card tool-card--${meta.kind} tool-card--${parsed.status}`}
    >
      <div className="tool-card__head">
        <div className="tool-card__title-wrap">
          <span className="tool-card__title">{meta.label}</span>
          {parsed.name.startsWith("mcp") || !TOOL_META[parsed.name] ? (
            <span className="tool-card__name">{parsed.name}</span>
          ) : null}
        </div>
        <span className={`tool-card__status tool-card__status--${parsed.status}`}>
          {statusLabel(parsed.status)}
        </span>
      </div>

      {parsed.summary ? (
        <div className="tool-card__summary" title={parsed.summary}>
          {parsed.summary}
        </div>
      ) : null}

      {parsed.result ? (
        <div className="tool-card__result">
          <pre className="tool-card__pre">{shown}</pre>
          {long ? (
            <button
              className="tool-card__more"
              type="button"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "收起" : `展开全部（${lines.length} 行）`}
            </button>
          ) : null}
        </div>
      ) : parsed.status === "running" ? (
        <div className="tool-card__pending">等待结果…</div>
      ) : null}
    </div>
  );
};
