import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/components/Select";
import { invoke } from "@/hooks/useTauri";

type CrawlerConfig = {
  base_url: string;
};

type CrawlerStatus = {
  status: string;
  platform?: string | null;
  crawler_type?: string | null;
  started_at?: string | null;
  error_message?: string | null;
  base_url?: string;
};

type LogEntry = {
  id: number;
  timestamp: string;
  level: string;
  message: string;
};

type DataFileInfo = {
  name: string;
  path: string;
  size: number;
  modified_at: number;
};

type StartForm = {
  platform: string;
  login_type: string;
  crawler_type: string;
  keywords: string;
  specified_ids: string;
  creator_ids: string;
  enable_comments: boolean;
  enable_sub_comments: boolean;
  save_option: string;
  headless: boolean;
  max_notes_count: string;
};

const PLATFORMS = [
  { value: "xhs", label: "小红书" },
  { value: "dy", label: "抖音" },
  { value: "ks", label: "快手" },
  { value: "bili", label: "B站" },
  { value: "wb", label: "微博" },
  { value: "tieba", label: "贴吧" },
  { value: "zhihu", label: "知乎" },
];

const LOGIN_TYPES = [
  { value: "qrcode", label: "扫码" },
  { value: "cookie", label: "Cookie" },
  { value: "phone", label: "手机号" },
];

const CRAWLER_TYPES = [
  { value: "search", label: "关键词搜索" },
  { value: "detail", label: "指定详情" },
  { value: "creator", label: "创作者主页" },
];

const SAVE_OPTIONS = [
  { value: "jsonl", label: "JSONL" },
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "excel", label: "Excel" },
  { value: "sqlite", label: "SQLite" },
];

const statusLabel = (s: string) => {
  switch (s) {
    case "running":
      return "运行中";
    case "stopping":
      return "停止中";
    case "error":
      return "错误";
    default:
      return "空闲";
  }
};

const formatSize = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export const CrawlerPanel = () => {
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8080");
  const [health, setHealth] = useState("");
  const [status, setStatus] = useState<CrawlerStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [files, setFiles] = useState<DataFileInfo[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<StartForm>({
    platform: "xhs",
    login_type: "qrcode",
    crawler_type: "search",
    keywords: "编程副业",
    specified_ids: "",
    creator_ids: "",
    enable_comments: true,
    enable_sub_comments: false,
    save_option: "jsonl",
    headless: false,
    max_notes_count: "15",
  });

  const running = status?.status === "running" || status?.status === "stopping";

  const patchForm = <K extends keyof StartForm>(key: K, value: StartForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const refreshStatus = useCallback(async () => {
    const st = await invoke<CrawlerStatus>("crawler_status");
    setStatus(st);
    return st;
  }, []);

  const refreshLogs = useCallback(async () => {
    const list = await invoke<LogEntry[]>("crawler_logs", { limit: 300 });
    setLogs(list || []);
  }, []);

  const refreshFiles = useCallback(async () => {
    const list = await invoke<DataFileInfo[]>("crawler_list_data", {
      platform: form.platform,
    });
    setFiles(list || []);
  }, [form.platform]);

  useEffect(() => {
    const boot = async () => {
      try {
        const cfg = await invoke<CrawlerConfig>("crawler_config_get");
        if (cfg?.base_url) setBaseUrl(cfg.base_url);
        try {
          const ok = await invoke<string>("crawler_health");
          setHealth(ok);
          await refreshStatus();
          await refreshLogs();
          await refreshFiles().catch(() => undefined);
        } catch (e) {
          setHealth("");
          setError(String(e));
        }
      } catch (e) {
        setError(String(e));
      }
    };
    void boot();
  }, [refreshFiles, refreshLogs, refreshStatus]);

  // 运行中轮询状态与日志（HTTP Worker）
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const st = await refreshStatus();
          await refreshLogs();
          if (st.status === "idle") {
            await refreshFiles().catch(() => undefined);
          }
        } catch {
          /* keep polling */
        }
      })();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [running, refreshFiles, refreshLogs, refreshStatus]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const saveConfig = async () => {
    setError("");
    setBusy(true);
    try {
      const cfg = await invoke<CrawlerConfig>("crawler_config_set", { baseUrl });
      setBaseUrl(cfg.base_url);
      const ok = await invoke<string>("crawler_health");
      setHealth(ok);
      await refreshStatus();
      await refreshLogs();
      await refreshFiles().catch(() => undefined);
    } catch (e) {
      setError(String(e));
      setHealth("");
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setError("");
    setBusy(true);
    try {
      await invoke("crawler_config_set", { baseUrl });
      const maxNotes = form.max_notes_count.trim()
        ? Number(form.max_notes_count)
        : undefined;
      const st = await invoke<CrawlerStatus>("crawler_start", {
        request: {
          platform: form.platform,
          login_type: form.login_type,
          crawler_type: form.crawler_type,
          keywords: form.keywords,
          specified_ids: form.specified_ids,
          creator_ids: form.creator_ids,
          enable_comments: form.enable_comments,
          enable_sub_comments: form.enable_sub_comments,
          save_option: form.save_option,
          headless: form.headless,
          max_notes_count:
            maxNotes && Number.isFinite(maxNotes) && maxNotes > 0
              ? maxNotes
              : null,
          max_comments_count: null,
          cookies: "",
          start_page: 1,
        },
      });
      setStatus(st);
      await refreshLogs();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setError("");
    setBusy(true);
    try {
      const st = await invoke<CrawlerStatus>("crawler_stop");
      setStatus(st);
      await refreshLogs();
      await refreshFiles().catch(() => undefined);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const typeHint = useMemo(() => {
    if (form.crawler_type === "detail") return "填写帖子/视频 ID，逗号分隔";
    if (form.crawler_type === "creator") return "填写创作者 ID 或主页链接，逗号分隔";
    return "关键词，逗号分隔";
  }, [form.crawler_type]);

  return (
    <div className="crawler-panel">
      <section className="crawler-card">
        <div className="crawler-card__head">
          <h2>Worker 连接（HTTP）</h2>
          <span className={`crawler-badge crawler-badge--${status?.status || "idle"}`}>
            {statusLabel(status?.status || "idle")}
          </span>
        </div>
        <p className="crawler-muted">
          连接 chatcms-collect FastAPI。请先在 collect 项目执行：
          <code> uv run uvicorn api.main:app --port 8080 --reload</code>
        </p>
        <div className="mcp-form-row">
          <label>Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://127.0.0.1:8080"
          />
        </div>
        <div className="crawler-actions">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void saveConfig()}>
            保存并检测
          </button>
          {health ? <span className="crawler-health">{health}</span> : null}
        </div>
      </section>

      <section className="crawler-card">
        <div className="crawler-card__head">
          <h2>任务配置</h2>
        </div>
        <div className="crawler-grid">
          <div className="mcp-form-row">
            <label>平台</label>
            <Select
              aria-label="平台"
              value={form.platform}
              options={PLATFORMS}
              onChange={(v) => patchForm("platform", v)}
            />
          </div>
          <div className="mcp-form-row">
            <label>登录</label>
            <Select
              aria-label="登录"
              value={form.login_type}
              options={LOGIN_TYPES}
              onChange={(v) => patchForm("login_type", v)}
            />
          </div>
          <div className="mcp-form-row">
            <label>类型</label>
            <Select
              aria-label="类型"
              value={form.crawler_type}
              options={CRAWLER_TYPES}
              onChange={(v) => patchForm("crawler_type", v)}
            />
          </div>
          <div className="mcp-form-row">
            <label>存储</label>
            <Select
              aria-label="存储"
              value={form.save_option}
              options={SAVE_OPTIONS}
              onChange={(v) => patchForm("save_option", v)}
            />
          </div>
        </div>

        <div className="mcp-form-row">
          <label>{typeHint}</label>
          {form.crawler_type === "search" ? (
            <input
              value={form.keywords}
              onChange={(e) => patchForm("keywords", e.target.value)}
            />
          ) : form.crawler_type === "detail" ? (
            <input
              value={form.specified_ids}
              onChange={(e) => patchForm("specified_ids", e.target.value)}
            />
          ) : (
            <input
              value={form.creator_ids}
              onChange={(e) => patchForm("creator_ids", e.target.value)}
            />
          )}
        </div>

        <div className="crawler-grid crawler-grid--checks">
          <label className="crawler-check">
            <input
              type="checkbox"
              checked={form.enable_comments}
              onChange={(e) => patchForm("enable_comments", e.target.checked)}
            />
            爬评论
          </label>
          <label className="crawler-check">
            <input
              type="checkbox"
              checked={form.enable_sub_comments}
              onChange={(e) => patchForm("enable_sub_comments", e.target.checked)}
            />
            二级评论
          </label>
          <label className="crawler-check">
            <input
              type="checkbox"
              checked={form.headless}
              onChange={(e) => patchForm("headless", e.target.checked)}
            />
            无头模式
          </label>
          <div className="mcp-form-row">
            <label>最大帖子数</label>
            <input
              value={form.max_notes_count}
              onChange={(e) => patchForm("max_notes_count", e.target.value)}
            />
          </div>
        </div>

        <div className="crawler-actions">
          {!running ? (
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void start()}>
              开始采集
            </button>
          ) : (
            <button type="button" className="btn-danger" disabled={busy} onClick={() => void stop()}>
              停止
            </button>
          )}
        </div>
        {error ? <p className="crawler-error">{error}</p> : null}
      </section>

      <section className="crawler-card crawler-card--logs">
        <div className="crawler-card__head">
          <h2>运行日志</h2>
          <button type="button" className="btn-ghost" onClick={() => void refreshLogs()}>
            刷新
          </button>
        </div>
        <div className="crawler-logs">
          {logs.length === 0 ? (
            <div className="crawler-logs__empty">暂无日志</div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className={`crawler-log crawler-log--${l.level}`}>
                <span className="crawler-log__lvl">{l.level}</span>
                <span className="crawler-log__msg">{l.message}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </section>

      <section className="crawler-card">
        <div className="crawler-card__head">
          <h2>数据文件</h2>
          <button type="button" className="btn-ghost" onClick={() => void refreshFiles()}>
            刷新
          </button>
        </div>
        {files.length === 0 ? (
          <p className="crawler-muted">暂无匹配文件（经 Worker /api/data/files）</p>
        ) : (
          <ul className="crawler-files">
            {files.slice(0, 30).map((f) => (
              <li key={f.path}>
                <span className="crawler-files__name">{f.path}</span>
                <span className="crawler-files__meta">{formatSize(f.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
