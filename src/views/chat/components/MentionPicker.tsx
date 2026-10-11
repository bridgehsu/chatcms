import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type {
  ChatAttachment,
  ChatAttachmentKind,
  McpServerInfo,
  Skill,
} from "@/types";

export type MentionOption = {
  kind: ChatAttachmentKind;
  id: string;
  label: string;
  description?: string;
  code?: string;
};

/** 桌面端仅技能 / MCP；渠道脚本只在浏览器插件 @ */
const DESKTOP_KINDS: ChatAttachmentKind[] = ["skill", "mcp"];

const KIND_META: Record<
  ChatAttachmentKind,
  { title: string; badge: string }
> = {
  script: { title: "脚本", badge: "脚本" },
  task: { title: "任务", badge: "任务" },
  skill: { title: "技能", badge: "技能" },
  mcp: { title: "工具", badge: "MCP" },
};

export const toAttachment = (opt: MentionOption): ChatAttachment => ({
  kind: opt.kind,
  id: opt.id,
  label: opt.label,
  code: opt.code,
});

type Props = {
  open: boolean;
  query: string;
  agentId?: string | null;
  excludeKeys?: string[];
  onPick: (opt: MentionOption) => void;
  onClose: () => void;
};

const MentionPicker = ({
  open,
  query,
  excludeKeys = [],
  onPick,
  onClose,
}: Props) => {
  const [options, setOptions] = useState<MentionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [skills, mcps] = await Promise.all([
          invoke<Skill[]>("skill_list"),
          invoke<McpServerInfo[]>("mcp_list"),
        ]);
        if (cancelled) return;
        const next: MentionOption[] = [];
        for (const s of skills.filter((x) => x.enabled && x.user_invocable)) {
          next.push({
            kind: "skill",
            id: s.name,
            label: s.name,
            description: s.description,
          });
        }
        for (const m of mcps.filter((x) => x.config.enabled !== false)) {
          next.push({
            kind: "mcp",
            id: m.name,
            label: m.name,
            description: m.config.description || undefined,
          });
        }
        setOptions(next);
        setActive(0);
      } catch (e) {
        console.warn("[ChatCMS] mention options", e);
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const exclude = new Set(excludeKeys);
    return options.filter((o) => {
      const key = `${o.kind}:${o.id}`;
      if (exclude.has(key)) return false;
      if (!q) return true;
      return (
        o.label.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.description?.toLowerCase().includes(q) ?? false) ||
        KIND_META[o.kind].title.includes(query.trim())
      );
    });
  }, [options, query, excludeKeys]);

  useEffect(() => {
    setActive(0);
  }, [query, filtered.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!filtered.length) return;
        setActive((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!filtered.length) return;
        setActive((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        const hit = filtered[active];
        if (hit) {
          e.preventDefault();
          e.stopPropagation();
          onPick(hit);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, filtered, active, onPick, onClose]);

  if (!open) return null;

  const byKind = (k: ChatAttachmentKind) => filtered.filter((o) => o.kind === k);
  const flat = filtered;

  return (
    <div
      ref={rootRef}
      className="mention-picker"
      role="listbox"
      aria-label="@ 引用"
    >
      {loading && <div className="mention-picker__empty">加载中…</div>}
      {!loading && !filtered.length && (
        <div className="mention-picker__empty">无匹配的技能 / MCP</div>
      )}
      {!loading &&
        DESKTOP_KINDS.map((kind) => {
          const items = byKind(kind);
          if (!items.length) return null;
          return (
            <div key={kind} className="mention-picker__group">
              <div className="mention-picker__group-title">
                {KIND_META[kind].title}
              </div>
              {items.map((opt) => {
                const idx = flat.indexOf(opt);
                return (
                  <button
                    key={`${opt.kind}:${opt.id}`}
                    type="button"
                    role="option"
                    aria-selected={idx === active}
                    className={`mention-picker__item${idx === active ? " is-active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => onPick(opt)}
                  >
                    <span
                      className={`mention-picker__badge mention-picker__badge--${opt.kind}`}
                    >
                      {KIND_META[opt.kind].badge}
                    </span>
                    <span className="mention-picker__body">
                      <span className="mention-picker__label">{opt.label}</span>
                      {opt.description && (
                        <span className="mention-picker__desc">
                          {opt.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
    </div>
  );
};

export default MentionPicker;
