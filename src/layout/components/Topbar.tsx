import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
        aria-label="新增分类"
        title="新增分类"
        onClick={openAddSection}
      >
        <IconPlus />
        <span>新增分类</span>
      </button>
    </>
  );
};

const VideoStudioActions = () => {
  const [healthOk, setHealthOk] = useState("");

  useEffect(() => {
    const onHealth = (e: Event) => {
      const detail = (e as CustomEvent<{ ok?: string }>).detail;
      setHealthOk(detail?.ok || "");
    };
    window.addEventListener("mpt:health", onHealth);
    return () => window.removeEventListener("mpt:health", onHealth);
  }, []);

  return (
    <span
      className={
        healthOk ? "mpt-shell__pill mpt-shell__pill--ok" : "mpt-shell__pill"
      }
      title={healthOk || "未连接"}
    >
      {healthOk ? "已连接" : "未连接"}
    </span>
  );
};

export const Topbar = () => {
  const { pathname } = useLocation();
  const activeSession = useChatStore((s) => s.activeSession);
  const pageTitle = titleForPath(pathname);
  const pageDesc = subtitleForPath(pathname);
  const isChat = pathname === "/chat" || pathname.startsWith("/chat/");
  const isMap = pathname === "/map";
  const isVideoStudio = pathname === "/videos/studio";
  const subtitle =
    isChat && activeSession?.title ? activeSession.title : pageDesc;

  return (
    <header className="topbar">
      <div className="topbar-text">
        <div className="topbar-title-row">
          <h1 className="topbar-title">{pageTitle}</h1>
          {isVideoStudio ? (
            <Link className="topbar-back" to="/videos">
              ← 返回视频管理
            </Link>
          ) : null}
        </div>
        {subtitle ? <p className="topbar-sub">{subtitle}</p> : null}
      </div>
      <div className="topbar-actions">
        {isMap ? <MapActions /> : null}
        {isVideoStudio ? <VideoStudioActions /> : null}
      </div>
    </header>
  );
};
