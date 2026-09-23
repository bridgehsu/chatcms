import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  IconCrawler,
  IconImages,
  IconPlus,
  IconPlay,
  IconRefresh,
  IconSave,
  IconStop,
  IconUpload,
  IconVideos,
} from "@/components/icons";
import { titleForPath, subtitleForPath } from "@/layout/nav";
import { useChatStore } from "@/stores/useChatStore";
import { MapSearch } from "@/views/map/components/MapSearch";
import { useBusinessMap } from "@/views/map/hooks/useBusinessMap";
import { AgentPicker } from "@/views/chat/components/AgentPicker";

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

/** 图片工厂列表 · 顶栏右侧操作 */
const ImagesFactoryActions = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onBusy = (e: Event) => {
      const detail = (e as CustomEvent<{ busy?: boolean }>).detail;
      setBusy(!!detail?.busy);
    };
    window.addEventListener("images:topbar-busy", onBusy);
    window.dispatchEvent(new CustomEvent("images:topbar-request"));
    return () => window.removeEventListener("images:topbar-busy", onBusy);
  }, []);

  return (
    <>
      <button
        type="button"
        className="topbar-action-btn"
        disabled={busy}
        onClick={() =>
          window.dispatchEvent(new CustomEvent("images:pick-upload"))
        }
      >
        <IconUpload />
        <span>{busy ? "处理中…" : "上传"}</span>
      </button>
      <button
        type="button"
        className="topbar-action-btn topbar-action-btn--primary"
        disabled={busy}
        onClick={() => navigate("/images/generate")}
      >
        <IconImages />
        <span>AI 生成</span>
      </button>
    </>
  );
};

/** 视频工厂列表 · 顶栏右侧操作 */
const VideosFactoryActions = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onBusy = (e: Event) => {
      const detail = (e as CustomEvent<{ busy?: boolean }>).detail;
      setBusy(!!detail?.busy);
    };
    window.addEventListener("videos:topbar-busy", onBusy);
    window.dispatchEvent(new CustomEvent("videos:topbar-request"));
    return () => window.removeEventListener("videos:topbar-busy", onBusy);
  }, []);

  return (
    <>
      <button
        type="button"
        className="topbar-action-btn"
        disabled={busy}
        onClick={() =>
          window.dispatchEvent(new CustomEvent("videos:pick-upload"))
        }
      >
        <IconUpload />
        <span>{busy ? "处理中…" : "上传"}</span>
      </button>
      <button
        type="button"
        className="topbar-action-btn topbar-action-btn--primary"
        disabled={busy}
        onClick={() => navigate("/videos/studio")}
      >
        <IconVideos />
        <span>制片</span>
      </button>
    </>
  );
};

const VideoStudioActions = () => {
  const [healthOk, setHealthOk] = useState("");
  const [state, setState] = useState({
    busy: false,
    canGenerate: false,
    progress: 0,
    mode: "clip" as "clip" | "model",
  });

  useEffect(() => {
    const onHealth = (e: Event) => {
      const detail = (e as CustomEvent<{ ok?: string }>).detail;
      setHealthOk(detail?.ok || "");
    };
    const onState = (e: Event) => {
      const detail = (e as CustomEvent<typeof state>).detail;
      if (!detail) return;
      setState({
        busy: !!detail.busy,
        canGenerate: !!detail.canGenerate,
        progress: Number(detail.progress) || 0,
        mode: detail.mode === "model" ? "model" : "clip",
      });
    };
    window.addEventListener("mpt:health", onHealth);
    window.addEventListener("mpt:topbar-state", onState);
    window.dispatchEvent(new CustomEvent("mpt:topbar-request"));
    return () => {
      window.removeEventListener("mpt:health", onHealth);
      window.removeEventListener("mpt:topbar-state", onState);
    };
  }, []);

  return (
    <>
      {state.mode === "clip" ? (
      <span
        className={
          healthOk ? "topbar-status topbar-status--ok" : "topbar-status"
        }
        title={healthOk || "未连接 MoneyPrinterTurbo"}
      >
        {healthOk ? "已连接" : "未连接"}
      </span>
      ) : null}
      {state.busy && state.mode === "clip" ? (
        <button
          type="button"
          className="topbar-action-btn topbar-action-btn--danger"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("mpt:cancel-generate"))
          }
        >
          <IconStop />
          <span>取消</span>
        </button>
      ) : null}
      <button
        type="button"
        className="topbar-action-btn topbar-action-btn--primary"
        disabled={state.busy || !state.canGenerate}
        onClick={() =>
          window.dispatchEvent(new CustomEvent("mpt:generate"))
        }
      >
        <IconPlay />
          <span>
          {state.busy
            ? state.mode === "model"
              ? "生成中…"
              : `生成中 ${Math.round(state.progress)}%`
            : "生成视频"}
          </span>
      </button>
    </>
  );
};

type CrawlerTopbarState = {
  busy: boolean;
  running: boolean;
};

const PermissionsActions = () => (
  <button
    type="button"
    className="topbar-action-btn topbar-action-btn--primary"
    onClick={() =>
      window.dispatchEvent(new CustomEvent("settings-permissions:add"))
    }
  >
    <IconPlus />
    <span>新增</span>
  </button>
);

const ChannelsActions = () => (
  <button
    type="button"
    className="topbar-action-btn topbar-action-btn--primary"
    onClick={() =>
      window.dispatchEvent(new CustomEvent("settings-channels:add"))
    }
  >
    <IconPlus />
    <span>新增</span>
  </button>
);

/** 智能会话 · 顶栏右侧主 Agent 选择 */
const ChatAgentActions = () => {
  const {
    activeSessionId,
    activeSession,
    preferredAgentId,
    isStreaming,
    pendingPermission,
    setPreferredAgentId,
    setSessionAgent,
  } = useChatStore();

  const sessionBound = Boolean(activeSession?.agent_id);
  const value = activeSession?.agent_id ?? preferredAgentId;
  const disabled = isStreaming || !!pendingPermission;

  const handleChange = (id: string | null) => {
    if (id == null) {
      setPreferredAgentId(null);
      return;
    }
    if (activeSessionId && activeSessionId !== "pending") {
      void setSessionAgent(id);
    } else {
      setPreferredAgentId(id);
    }
  };

  return (
    <AgentPicker
      value={value}
      onChange={handleChange}
      disabled={disabled}
      allowAuto={!sessionBound}
      placement="bottom"
      variant="topbar"
    />
  );
};

const EvalActions = () => {
  const [state, setState] = useState({ busy: false, hasReport: false });

  useEffect(() => {
    const onState = (e: Event) => {
      const detail = (e as CustomEvent<typeof state>).detail;
      if (!detail) return;
      setState({ busy: !!detail.busy, hasReport: !!detail.hasReport });
    };
    window.addEventListener("settings-eval:topbar-state", onState);
    window.dispatchEvent(new CustomEvent("settings-eval:topbar-request"));
    return () =>
      window.removeEventListener("settings-eval:topbar-state", onState);
  }, []);

  return (
    <button
      type="button"
      className="topbar-action-btn topbar-action-btn--primary"
      disabled={state.busy}
      onClick={() =>
        window.dispatchEvent(new CustomEvent("settings-eval:run"))
      }
    >
      {state.hasReport ? <IconRefresh /> : <IconPlay />}
      <span>{state.busy ? "评测中…" : state.hasReport ? "重新评测" : "运行评测"}</span>
    </button>
  );
};

const ObservabilityActions = () => {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onBusy = (e: Event) => {
      const detail = (e as CustomEvent<{ busy?: boolean }>).detail;
      setBusy(!!detail?.busy);
    };
    window.addEventListener("settings-obs:topbar-busy", onBusy);
    window.dispatchEvent(new CustomEvent("settings-obs:topbar-request"));
    return () => window.removeEventListener("settings-obs:topbar-busy", onBusy);
  }, []);

  return (
    <button
      type="button"
      className="topbar-action-btn"
      disabled={busy}
      onClick={() =>
        window.dispatchEvent(new CustomEvent("settings-obs:refresh"))
      }
    >
      <IconRefresh />
      <span>{busy ? "刷新中…" : "刷新"}</span>
    </button>
  );
};

const GeneralActions = () => {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onBusy = (e: Event) => {
      const detail = (e as CustomEvent<{ busy?: boolean }>).detail;
      setBusy(!!detail?.busy);
    };
    window.addEventListener("settings-general:topbar-busy", onBusy);
    window.dispatchEvent(new CustomEvent("settings-general:topbar-request"));
    return () =>
      window.removeEventListener("settings-general:topbar-busy", onBusy);
  }, []);

  return (
    <button
      type="button"
      className="topbar-action-btn topbar-action-btn--primary"
      disabled={busy}
      onClick={() =>
        window.dispatchEvent(new CustomEvent("settings-general:save"))
      }
    >
      <IconSave />
      <span>{busy ? "保存中…" : "保存"}</span>
    </button>
  );
};

const CrawlerConfigActions = () => {
  const [state, setState] = useState<CrawlerTopbarState>({
    busy: false,
    running: false,
  });

  useEffect(() => {
    const onState = (e: Event) => {
      const detail = (e as CustomEvent<CrawlerTopbarState>).detail;
      if (!detail) return;
      setState({
        busy: !!detail.busy,
        running: !!detail.running,
      });
    };
    window.addEventListener("crawler:topbar-state", onState);
    window.dispatchEvent(new CustomEvent("crawler:topbar-request"));
    return () => window.removeEventListener("crawler:topbar-state", onState);
  }, []);

  return (
    <>
      <Link className="topbar-back" to="/crawler">
        ← 返回列表
      </Link>
      <button
        type="button"
        className="topbar-action-btn"
        disabled={state.busy}
        onClick={() => window.dispatchEvent(new CustomEvent("crawler:save-task"))}
      >
        <IconSave />
        <span>保存任务</span>
      </button>
      {!state.running ? (
        <button
          type="button"
          className="topbar-action-btn topbar-action-btn--primary"
          disabled={state.busy}
          onClick={() => window.dispatchEvent(new CustomEvent("crawler:start"))}
        >
          <IconCrawler />
          <span>开始采集</span>
        </button>
      ) : (
        <button
          type="button"
          className="topbar-action-btn topbar-action-btn--danger"
          disabled={state.busy}
          onClick={() => window.dispatchEvent(new CustomEvent("crawler:stop"))}
        >
          <IconStop />
          <span>停止</span>
        </button>
      )}
    </>
  );
};

export const Topbar = () => {
  const { pathname } = useLocation();
  const pageTitle = titleForPath(pathname);
  const pageSub = subtitleForPath(pathname);
  const isMap = pathname === "/map";
  const isImages = pathname === "/images";
  const isVideos = pathname === "/videos";
  const isVideoStudio = pathname === "/videos/studio";
  const isCrawlerConfig = /^\/crawler\/[^/]+$/.test(pathname);
  const isPermissions = pathname === "/settings/permissions";
  const isGeneral = pathname === "/settings/general";
  const isEval = pathname === "/settings/eval";
  const isObservability = pathname === "/settings/observability";
  const isChannels = pathname === "/settings/channels";
  const isChat = pathname === "/chat";

  return (
    <header className={`topbar${pageSub ? " topbar--with-sub" : ""}`}>
      <div className="topbar-text">
        <div className="topbar-title-row">
          <h1 className="topbar-title">{pageTitle}</h1>
        </div>
        {pageSub ? <p className="topbar-sub">{pageSub}</p> : null}
      </div>
      <div className="topbar-actions">
        {isChat ? <ChatAgentActions /> : null}
        {isMap ? <MapActions /> : null}
        {isImages ? <ImagesFactoryActions /> : null}
        {isVideos ? <VideosFactoryActions /> : null}
        {isVideoStudio ? <VideoStudioActions /> : null}
        {isCrawlerConfig ? <CrawlerConfigActions /> : null}
        {isGeneral ? <GeneralActions /> : null}
        {isPermissions ? <PermissionsActions /> : null}
        {isEval ? <EvalActions /> : null}
        {isObservability ? <ObservabilityActions /> : null}
        {isChannels ? <ChannelsActions /> : null}
      </div>
    </header>
  );
};
