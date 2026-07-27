import { useEffect, useMemo, useRef, useState } from "react";
import { useChatStore } from "@/stores/useChatStore";

const TIMEOUT_SEC = 60;
const PREVIEW_LINES = 24;

type ToolView = {
  kind: "bash" | "write_file" | "generic";
  title: string;
  subtitle: string;
  accent: "amber" | "blue" | "slate";
  primaryLabel: string;
  bodyLabel: string;
  body: string;
  meta?: string;
};

const asString = (v: unknown) => (typeof v === "string" ? v : null);

const buildToolView = (
  toolName: string,
  input: Record<string, unknown>,
): ToolView => {
  if (toolName === "bash") {
    const command =
      asString(input.command) ??
      asString(input.cmd) ??
      JSON.stringify(input, null, 2);
    return {
      kind: "bash",
      title: "执行终端命令",
      subtitle: "Agent 想在本机运行下面这条命令",
      accent: "amber",
      primaryLabel: "允许执行",
      bodyLabel: "命令",
      body: command,
    };
  }

  if (toolName === "write_file") {
    const path =
      asString(input.path) ?? asString(input.file_path) ?? "（未指定路径）";
    const content = asString(input.content) ?? asString(input.contents) ?? "";
    const lines = content.split("\n");
    const truncated = lines.length > PREVIEW_LINES;
    const preview = truncated
      ? `${lines.slice(0, PREVIEW_LINES).join("\n")}\n…`
      : content || "（空内容）";
    return {
      kind: "write_file",
      title: "写入文件",
      subtitle: "将创建或覆盖以下文件",
      accent: "blue",
      primaryLabel: "允许写入",
      bodyLabel: "内容预览",
      body: preview,
      meta: truncated ? `${path} · 共 ${lines.length} 行` : path,
    };
  }

  return {
    kind: "generic",
    title: "需要确认",
    subtitle: `Agent 请求执行工具 ${toolName}`,
    accent: "slate",
    primaryLabel: "允许",
    bodyLabel: "参数",
    body: JSON.stringify(input, null, 2),
  };
};

export const PermissionPrompt = () => {
  const pendingPermission = useChatStore((s) => s.pendingPermission);
  const respondPermission = useChatStore((s) => s.respondPermission);
  const [busy, setBusy] = useState(false);
  const [remain, setRemain] = useState(TIMEOUT_SEC);
  const denyRef = useRef<HTMLButtonElement>(null);
  const requestId = pendingPermission?.request_id ?? null;

  const view = useMemo(() => {
    if (!pendingPermission) return null;
    return buildToolView(pendingPermission.tool_name, pendingPermission.input);
  }, [pendingPermission]);

  const respond = async (allowed: boolean) => {
    if (!requestId || busy) return;
    setBusy(true);
    try {
      await respondPermission(requestId, allowed);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!requestId) return;
    setBusy(false);
    setRemain(TIMEOUT_SEC);
    denyRef.current?.focus();

    const started = Date.now();
    const timer = window.setInterval(() => {
      const left = Math.max(
        0,
        TIMEOUT_SEC - Math.floor((Date.now() - started) / 1000),
      );
      setRemain(left);
    }, 250);

    return () => window.clearInterval(timer);
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;

    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === "Escape") {
        e.preventDefault();
        void respondPermission(requestId, false);
        return;
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void respondPermission(requestId, true);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestId, busy, respondPermission]);

  if (!pendingPermission || !view) return null;

  return (
    <div
      className={`permission-prompt permission-prompt--${view.accent}`}
      role="alertdialog"
      aria-labelledby="permission-prompt-title"
      aria-describedby="permission-prompt-desc"
    >
      <div className="permission-prompt__head">
        <div>
          <h2 id="permission-prompt-title" className="permission-prompt__title">
            {view.title}
          </h2>
          <p id="permission-prompt-desc" className="permission-prompt__sub">
            {view.subtitle}
          </p>
        </div>
        <span className="permission-prompt__badge">本机执行</span>
      </div>

      {view.meta ? (
        <div className="permission-prompt__meta">{view.meta}</div>
      ) : null}

      <div className="permission-prompt__body">
        <div className="permission-prompt__body-label">{view.bodyLabel}</div>
        <pre className="permission-prompt__code">{view.body}</pre>
      </div>

      <div className="permission-prompt__footer">
        <span className="permission-prompt__timer">
          {remain}s 后未操作将自动拒绝
        </span>
        <div className="permission-prompt__actions">
          <button
            ref={denyRef}
            className="permission-prompt__btn permission-prompt__btn--deny"
            onClick={() => void respond(false)}
            disabled={busy}
            type="button"
          >
            拒绝
          </button>
          <button
            className="permission-prompt__btn permission-prompt__btn--allow"
            onClick={() => void respond(true)}
            disabled={busy}
            type="button"
          >
            {busy ? "处理中…" : view.primaryLabel}
          </button>
        </div>
      </div>

      <p className="permission-prompt__hint">Esc 拒绝 · ⌘/Ctrl+Enter 允许</p>
    </div>
  );
};
