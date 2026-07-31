import { useLocation } from "react-router-dom";
import { IconPlus } from "@/components/icons";
import { subtitleForPath, titleForPath } from "@/layout/nav";
import { useChatStore } from "@/stores/useChatStore";
import { MapSearch } from "@/views/map/components/MapSearch";
import { useBusinessMap } from "@/views/map/hooks/useBusinessMap";

const MapActions = () => {
  const { favorites, sections } = useBusinessMap();

  const openAddSection = () => {
    window.dispatchEvent(new CustomEvent("map:open-add-section"));
  };

  return (
    <>
      <MapSearch favorites={favorites} sections={sections} />
      <button
        type="button"
        className="topbar-action-btn"
        aria-label="新增导航分类"
        title="新增导航分类"
        onClick={openAddSection}
      >
        <IconPlus />
        <span>新增导航分类</span>
      </button>
    </>
  );
};

export const Topbar = () => {
  const { pathname } = useLocation();
  const activeSession = useChatStore((s) => s.activeSession);
  const pageTitle = titleForPath(pathname);
  const pageDesc = subtitleForPath(pathname);
  const isChat = pathname === "/chat" || pathname.startsWith("/chat/");
  const isMap = pathname === "/map";
  const subtitle =
    isChat && activeSession?.title ? activeSession.title : pageDesc;

  return (
    <header className="topbar">
      <div className="topbar-text">
        <h1 className="topbar-title">{pageTitle}</h1>
        {subtitle ? <p className="topbar-sub">{subtitle}</p> : null}
      </div>
      <div className="topbar-actions">
        {isMap ? <MapActions /> : null}
      </div>
    </header>
  );
};
