import { useEffect, useRef, useState } from "react";
import { App as AntdApp, Switch } from "antd";
import { PageShell } from "@/layout/components/PageShell";
import { invoke } from "@/hooks/useTauri";

export type GeneralConfigView = {
  data_root: string;
  default_data_root: string;
  video_base_url: string;
  publish_bridge_port: number;
  crawler_base_url: string;
  use_system_proxy: boolean;
  http_proxy_url: string;
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
  const [useProxy, setUseProxy] = useState(false);
  const [proxyUrl, setProxyUrl] = useState("");

  const formRef = useRef({
    dataRoot,
    videoUrl,
    bridgePort,
    crawlerUrl,
    useProxy,
    proxyUrl,
  });
  formRef.current = {
    dataRoot,
    videoUrl,
    bridgePort,
    crawlerUrl,
    useProxy,
    proxyUrl,
  };

  const applyView = (v: GeneralConfigView) => {
    setDataRoot(v.data_root ?? "");
    setDefaultRoot(v.default_data_root ?? "");
    setVideoUrl(v.video_base_url || "http://127.0.0.1:6060");
    setBridgePort(v.publish_bridge_port || 17890);
    setCrawlerUrl(v.crawler_base_url || "http://127.0.0.1:8080");
    setUseProxy(!!v.use_system_proxy);
    setProxyUrl(v.http_proxy_url || "");
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
      if (form.useProxy && !form.proxyUrl.trim()) {
        message.error("启用代理时请填写代理地址");
        return;
      }
      const r = await invoke<SetResult>("general_config_set", {
        dataRoot: form.dataRoot.trim(),
        videoBaseUrl: form.videoUrl.trim(),
        publishBridgePort: Math.floor(port),
        crawlerBaseUrl: form.crawlerUrl.trim(),
        useSystemProxy: form.useProxy,
        httpProxyUrl: form.proxyUrl.trim(),
      });
      applyView(r.config);
      if (r.restart_required) {
        message.warning("已保存。存储根或发布桥端口变更后请重启应用生效");
      } else {
        message.success(
          form.useProxy
            ? `已保存（模型经代理 ${form.proxyUrl.trim()}）`
            : "已保存（模型请求直连）",
        );
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
            <section className="settings-card">
              <header className="settings-card__head">
                <h3 className="settings-card__title">存储</h3>
                <span className="settings-card__hint">变更后需重启</span>
              </header>
              <div className="settings-card__body">
                <div className="settings-card__row">
                  <div className="settings-card__meta">
                    <label htmlFor="general-data-root">存储根目录</label>
                    <p>
                      数据库、图片、视频、工作区与技能落盘路径。留空使用系统默认
                      {defaultRoot ? `（${defaultRoot}）` : ""}。
                    </p>
                  </div>
                  <div className="settings-card__control">
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
              </div>
            </section>

            <section className="settings-card">
              <header className="settings-card__head">
                <h3 className="settings-card__title">外挂服务</h3>
                <span className="settings-card__hint">本机 Worker / 桥</span>
              </header>
              <div className="settings-card__body">
                <div className="settings-card__row">
                  <div className="settings-card__meta">
                    <label htmlFor="general-video-url">视频服务</label>
                    <p>chatcms-video FastAPI，制片页共用</p>
                  </div>
                  <div className="settings-card__control">
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
                <div className="settings-card__row">
                  <div className="settings-card__meta">
                    <label htmlFor="general-crawler-url">采集服务</label>
                    <p>chatcms-collect Worker，媒体采集页共用</p>
                  </div>
                  <div className="settings-card__control">
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
                <div className="settings-card__row">
                  <div className="settings-card__meta">
                    <label htmlFor="general-bridge-port">发布桥端口</label>
                    <p>浏览器插件自动填表，默认 17890。变更后需重启。</p>
                  </div>
                  <div className="settings-card__control settings-card__control--port">
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
            </section>

            <section className="settings-card">
              <header className="settings-card__head">
                <h3 className="settings-card__title">网络代理</h3>
                <span className="settings-card__hint">仅影响模型请求 · 保存即生效</span>
              </header>
              <div className="settings-card__body">
                <div className="settings-card__row">
                  <div className="settings-card__meta">
                    <label htmlFor="general-use-proxy">启用 HTTP 代理</label>
                    <p>
                      关闭（默认）直连，适合局域网与国内 API。开启后必须填写下方代理地址，不再读取环境变量
                      HTTP_PROXY。
                    </p>
                  </div>
                  <div className="settings-card__control settings-card__control--switch">
                    <Switch
                      id="general-use-proxy"
                      checked={useProxy}
                      disabled={busy}
                      onChange={setUseProxy}
                      checkedChildren="开"
                      unCheckedChildren="关"
                    />
                  </div>
                </div>
                {useProxy ? (
                  <div className="settings-card__row">
                    <div className="settings-card__meta">
                      <label htmlFor="general-proxy-url">代理地址</label>
                      <p>例如 Clash HTTP 端口：http://127.0.0.1:7890</p>
                    </div>
                    <div className="settings-card__control">
                      <input
                        id="general-proxy-url"
                        className="general-config__input"
                        value={proxyUrl}
                        disabled={busy}
                        onChange={(e) => setProxyUrl(e.target.value)}
                        placeholder="http://127.0.0.1:7890"
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </form>
        )}
      </div>
    </PageShell>
  );
};
