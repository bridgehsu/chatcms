import { useEffect, useRef, useState } from "react";
import { App as AntdApp } from "antd";
import { PageShell } from "@/layout/components/PageShell";
import { invoke } from "@/hooks/useTauri";

export type GeneralConfigView = {
  data_root: string;
  default_data_root: string;
  video_base_url: string;
  publish_bridge_port: number;
  crawler_base_url: string;
};

type SetResult = {
  config: GeneralConfigView;
  restart_required: boolean;
};

const emitBusy = (busy: boolean) => {
  window.dispatchEvent(
    new CustomEvent("settings-general:topbar-busy", { detail: { busy } }),
  );
};

/** 系统设置 · 全局配置 */
export const GeneralPage = () => {
  const { message } = AntdApp.useApp();
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dataRoot, setDataRoot] = useState("");
  const [defaultRoot, setDefaultRoot] = useState("");
  const [videoUrl, setVideoUrl] = useState("http://127.0.0.1:6060");
  const [bridgePort, setBridgePort] = useState(17890);
  const [crawlerUrl, setCrawlerUrl] = useState("http://127.0.0.1:8080");

  const formRef = useRef({ dataRoot, videoUrl, bridgePort, crawlerUrl });
  formRef.current = { dataRoot, videoUrl, bridgePort, crawlerUrl };

  const applyView = (v: GeneralConfigView) => {
    setDataRoot(v.data_root ?? "");
    setDefaultRoot(v.default_data_root ?? "");
    setVideoUrl(v.video_base_url || "http://127.0.0.1:6060");
    setBridgePort(v.publish_bridge_port || 17890);
    setCrawlerUrl(v.crawler_base_url || "http://127.0.0.1:8080");
  };

  const load = async () => {
    setBusy(true);
    emitBusy(true);
    try {
      const v = await invoke<GeneralConfigView>("general_config_get");
      applyView(v);
      setLoaded(true);
    } catch (e) {
      message.error(String(e));
    } finally {
      setBusy(false);
      emitBusy(false);
    }
  };

  const save = async () => {
    const form = formRef.current;
    setBusy(true);
    emitBusy(true);
    try {
      const port = Number(form.bridgePort);
      if (!Number.isFinite(port) || port < 1024 || port > 65535) {
        message.error("发布桥端口需在 1024–65535");
        return;
      }
      const r = await invoke<SetResult>("general_config_set", {
        dataRoot: form.dataRoot.trim(),
        videoBaseUrl: form.videoUrl.trim(),
        publishBridgePort: Math.floor(port),
        crawlerBaseUrl: form.crawlerUrl.trim(),
      });
      applyView(r.config);
      if (r.restart_required) {
        message.warning("已保存。存储根或发布桥端口变更后请重启应用生效");
      } else {
        message.success("已保存");
      }
    } catch (e) {
      message.error(String(e));
    } finally {
      setBusy(false);
      emitBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onSave = () => void save();
    const onRequest = () => emitBusy(busy);
    window.addEventListener("settings-general:save", onSave);
    window.addEventListener("settings-general:topbar-request", onRequest);
    return () => {
      window.removeEventListener("settings-general:save", onSave);
      window.removeEventListener("settings-general:topbar-request", onRequest);
    };
  });

  return (
    <PageShell>
      <div className="page settings-page">
        {!loaded ? (
          <p className="general-config__loading">加载中…</p>
        ) : (
          <form
            className="general-config"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="general-config__list">
              <div className="general-config__row">
                <div className="general-config__meta">
                  <label htmlFor="general-data-root">存储根目录</label>
                  <p>
                    数据库、图片、视频、工作区与技能落盘路径。留空使用系统默认
                    {defaultRoot ? `（${defaultRoot}）` : ""}。变更后需重启。
                  </p>
                </div>
                <div className="general-config__control">
                  <input
                    id="general-data-root"
                    className="general-config__input"
                    value={dataRoot}
                    disabled={busy}
                    onChange={(e) => setDataRoot(e.target.value)}
                    placeholder={defaultRoot || "系统默认目录"}
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="general-config__row">
                <div className="general-config__meta">
                  <label htmlFor="general-video-url">视频服务</label>
                  <p>chatcms-video FastAPI，制片页共用</p>
                </div>
                <div className="general-config__control">
                  <input
                    id="general-video-url"
                    className="general-config__input"
                    value={videoUrl}
                    disabled={busy}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="http://127.0.0.1:6060"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="general-config__row">
                <div className="general-config__meta">
                  <label htmlFor="general-crawler-url">采集服务</label>
                  <p>chatcms-collect Worker，媒体采集页共用</p>
                </div>
                <div className="general-config__control">
                  <input
                    id="general-crawler-url"
                    className="general-config__input"
                    value={crawlerUrl}
                    disabled={busy}
                    onChange={(e) => setCrawlerUrl(e.target.value)}
                    placeholder="http://127.0.0.1:8080"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="general-config__row">
                <div className="general-config__meta">
                  <label htmlFor="general-bridge-port">发布桥端口</label>
                  <p>浏览器插件自动填表，默认 17890。变更后需重启。</p>
                </div>
                <div className="general-config__control general-config__control--port">
                  <span className="general-config__prefix">127.0.0.1:</span>
                  <input
                    id="general-bridge-port"
                    className="general-config__input general-config__input--port"
                    type="number"
                    min={1024}
                    max={65535}
                    value={bridgePort}
                    disabled={busy}
                    onChange={(e) => setBridgePort(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </PageShell>
  );
};
