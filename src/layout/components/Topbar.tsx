import { useState } from "react";
import { useLocation } from "react-router-dom";
import { IconPlus } from "@/components/icons";
import { subtitleForPath, titleForPath } from "@/layout/nav";
import { useChatStore } from "@/stores/useChatStore";
import { NavCustomModal } from "./NavCustomModal";
import { useCustomNav } from "../hooks/useCustomNav";

export const Topbar = () => {
  const { pathname } = useLocation();
  const activeSession = useChatStore((s) => s.activeSession);
  const pageTitle = titleForPath(pathname);
  const pageDesc = subtitleForPath(pathname);
  const isChat = pathname === "/chat" || pathname.startsWith("/chat/");
  const isMap = pathname === "/map";
  const subtitle =
    isChat && activeSession?.title ? activeSession.title : pageDesc;

  const [navModal, setNavModal] = useState(false);
  const { add } = useCustomNav();

  return (
    <>
      <header className="topbar">
        <div className="topbar-text">
          <h1 className="topbar-title">{pageTitle}</h1>
          {subtitle ? <p className="topbar-sub">{subtitle}</p> : null}
        </div>
        <div className="topbar-actions">
          {isMap ? (
            <button
              type="button"
              className="topbar-action-btn"
              aria-label="新增导航"
              title="新增导航"
              onClick={() => setNavModal(true)}
            >
              <IconPlus />
              <span>新增导航</span>
            </button>
          ) : null}
        </div>
      </header>

      {navModal ? (
        <NavCustomModal
          entry={null}
          onClose={() => setNavModal(false)}
          onSave={(label, path, sortOrder) => add(label, path, sortOrder)}
        />
      ) : null}
    </>
  );
};
