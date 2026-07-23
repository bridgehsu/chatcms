import { useEffect, useState } from "react";
import { IconChannels, IconMemory } from "@/components/icons";
import { KnowledgePanel } from "@/views/settings/components/KnowledgePanel";
import { ChannelPanel } from "@/views/settings/components/ChannelPanel";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "knowledge" | "channels";

const TABS: { key: Tab; label: string; Icon: typeof IconMemory }[] = [
  { key: "knowledge", label: "记忆", Icon: IconMemory },
  { key: "channels", label: "渠道", Icon: IconChannels },
];

/** 系统设置弹窗（记忆 / 渠道；模型配置在独立页面） */
export const SettingsModal = ({ open, onClose }: Props) => {
  const [tab, setTab] = useState<Tab>("knowledge");

  useEffect(() => {
    if (!open) return;
    setTab("knowledge");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="settings-modal__titlebar">
          <div className="settings-modal__traffic">
            <button
              type="button"
              className="traffic-btn traffic-btn--close"
              aria-label="关闭"
              onClick={onClose}
            />
            <button
              type="button"
              className="traffic-btn traffic-btn--min"
              aria-label="最小化"
              tabIndex={-1}
            />
            <button
              type="button"
              className="traffic-btn traffic-btn--max"
              aria-label="最大化"
              tabIndex={-1}
            />
          </div>
          <h2 id="settings-title" className="settings-modal__window-title">
            设置
          </h2>
          <div className="settings-modal__titlebar-spacer" aria-hidden="true" />
        </div>

        <div className="settings-modal__toolbar" role="tablist">
          {TABS.map((t) => {
            const { Icon } = t;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`settings-modal__tab${tab === t.key ? " is-active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                <span className="settings-modal__tab-icon">
                  <Icon />
                </span>
                <span className="settings-modal__tab-label">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="settings-modal__body">
          {tab === "knowledge" && <KnowledgePanel />}
          {tab === "channels" && <ChannelPanel />}
        </div>

        <footer className="settings-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            好
          </button>
        </footer>
      </div>
    </div>
  );
};
