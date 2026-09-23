import { useEffect, useRef, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { AgentProfile } from "@/types";

type Props = {
  /** 当前选中的 agent id；null = 自动（按意图 / 默认） */
  value: string | null;
  onChange: (agentId: string | null) => void;
  disabled?: boolean;
  /** 会话已绑定角色时不允许选「自动」 */
  allowAuto?: boolean;
  /** 菜单展开方向：顶栏用 bottom，输入区旁用 top */
  placement?: "top" | "bottom";
  /** 视觉变体：顶栏对齐 action 按钮 */
  variant?: "default" | "topbar";
};

const initialOf = (name: string) => {
  const t = name.trim();
  if (!t) return "A";
  return t.slice(0, 1).toUpperCase();
};

/** 会话主 Agent 选择器 */
export const AgentPicker = ({
  value,
  onChange,
  disabled = false,
  allowAuto = true,
  placement = "bottom",
  variant = "default",
}: Props) => {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    invoke<AgentProfile[]>("agent_list")
      .then((list) => setAgents(list.filter((a) => a.enabled)))
      .catch(console.error);
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = agents.find((a) => a.id === value);
  const isAuto = value == null && allowAuto;
  const title = isAuto
    ? "自动选角"
    : active
      ? active.name
      : value
        ? "未知代理"
        : "选择代理";
  const subtitle = isAuto ? "按意图 / 默认" : (active?.slug ?? null);
  const avatar = isAuto ? "自" : initialOf(active?.name ?? title);

  const pickAuto = () => {
    if (disabled || !allowAuto) return;
    onChange(null);
    setOpen(false);
  };

  const pickAgent = (id: string) => {
    if (disabled) return;
    onChange(id);
    setOpen(false);
  };

  const rootClass = [
    "agent-picker",
    `agent-picker--${placement}`,
    variant === "topbar" ? "agent-picker--topbar" : "agent-picker--default",
    open ? "is-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        className="agent-picker__trigger"
        onClick={() => {
          if (disabled) return;
          refresh();
          setOpen((v) => !v);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="选择会话代理"
        title={subtitle ? `${title} · ${subtitle}` : title}
      >
        <span className={`agent-picker__avatar${isAuto ? " is-auto" : ""}`} aria-hidden>
          {avatar}
        </span>
        <span className="agent-picker__meta">
          <span className="agent-picker__title">{title}</span>
        </span>
        <svg
          className="agent-picker__chevron"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          aria-hidden="true"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>

      {open && (
        <ul className="agent-picker__menu" role="listbox" aria-label="选择会话代理">
          {allowAuto && (
            <>
              <li role="option" aria-selected={isAuto}>
                <button
                  type="button"
                  className={`agent-picker__item${isAuto ? " is-active" : ""}`}
                  onClick={pickAuto}
                >
                  <span className="agent-picker__avatar is-auto" aria-hidden>
                    自
                  </span>
                  <span className="agent-picker__item-text">
                    <span className="agent-picker__item-title">自动选角</span>
                    <span className="agent-picker__item-desc">按意图或全局默认</span>
                  </span>
                  {isAuto && <CheckIcon />}
                </button>
              </li>
              {agents.length > 0 && (
                <li role="separator" className="agent-picker__divider" />
              )}
            </>
          )}

          {agents.map((a) => {
            const selected = a.id === value;
            return (
              <li key={a.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`agent-picker__item${selected ? " is-active" : ""}`}
                  onClick={() => pickAgent(a.id)}
                >
                  <span className="agent-picker__avatar" aria-hidden>
                    {initialOf(a.name)}
                  </span>
                  <span className="agent-picker__item-text">
                    <span className="agent-picker__item-title">{a.name}</span>
                    <span className="agent-picker__item-desc">
                      {a.remark?.trim() || a.slug}
                    </span>
                  </span>
                  {selected && <CheckIcon />}
                </button>
              </li>
            );
          })}

          {agents.length === 0 && (
            <li className="agent-picker__empty">暂无启用代理，请到「代理管理」添加</li>
          )}
        </ul>
      )}
    </div>
  );
};

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    aria-hidden="true"
    className="agent-picker__check"
  >
    <path
      d="M2.5 7L5.5 10L11.5 4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
