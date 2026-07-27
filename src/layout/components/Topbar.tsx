import { useLocation } from "react-router-dom";
import { ThemeToggle } from "@/layout/components/ThemeToggle";
import { subtitleForPath, titleForPath } from "@/layout/nav";
import { useChatStore } from "@/stores/useChatStore";

export const Topbar = () => {
  const { pathname } = useLocation();
  const activeSession = useChatStore((s) => s.activeSession);
  const pageTitle = titleForPath(pathname);
  const pageDesc = subtitleForPath(pathname);
  const isChat = pathname === "/chat" || pathname.startsWith("/chat/");
  /** 会话页优先显示当前会话名；其它页与无会话时显示导航描述 */
  const subtitle =
    isChat && activeSession?.title ? activeSession.title : pageDesc;

  return (
    <header className="topbar">
      <div className="topbar-text">
        <h1 className="topbar-title">{pageTitle}</h1>
        {subtitle ? <p className="topbar-sub">{subtitle}</p> : null}
      </div>
      <div className="topbar-actions">
        <ThemeToggle />
      </div>
    </header>
  );
};
