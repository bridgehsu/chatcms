import { useLocation } from "react-router-dom";
import { titleForPath } from "@/layout/nav";
import { useChatStore } from "@/stores/useChatStore";

export const Topbar = () => {
  const { pathname } = useLocation();
  const activeSession = useChatStore((s) => s.activeSession);
  const pageTitle = titleForPath(pathname);
  const isChat = pathname === "/chat" || pathname.startsWith("/chat/");
  const subtitle = isChat ? activeSession?.title : undefined;

  return (
    <header className="topbar">
      <div className="topbar-text">
        <h1 className="topbar-title">{pageTitle}</h1>
        {subtitle && <p className="topbar-sub">{subtitle}</p>}
      </div>
    </header>
  );
};
