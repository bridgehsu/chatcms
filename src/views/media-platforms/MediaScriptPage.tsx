import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { invoke } from "@/hooks/useTauri";
import type { MediaPlatform, PublishScriptView } from "@/types";

const KIND_LABEL: Record<string, string> = {
  dynamic: "动态",
  article: "文章",
  video: "视频",
};

type ScriptKind = "publish" | "collect";

const CMDS = {
  publish: {
    get: "plugin:media_platforms|publish_script_get",
    save: "plugin:media_platforms|publish_script_save_draft",
    publish: "plugin:media_platforms|publish_script_publish",
    discard: "plugin:media_platforms|publish_script_discard_draft",
    title: "填表脚本",
    placeholder: "// 发布填表 JS；仅「发布」后扩展可通过桥拉取",
    okPublish: (v: number) => `已发布为 v${v}（扩展桥 GET /publish/script）`,
  },
  collect: {
    get: "plugin:media_platforms|collect_script_get",
    save: "plugin:media_platforms|collect_script_save_draft",
    publish: "plugin:media_platforms|collect_script_publish",
    discard: "plugin:media_platforms|collect_script_discard_draft",
    title: "采集脚本",
    placeholder: "// 平台采集 JS；仅「发布」后扩展可通过桥拉取",
    okPublish: (v: number) => `已发布为 v${v}（扩展桥 GET /collect/script）`,
  },
} as const;

type Props = {
  /** 不传则根据路径判断 */
  scriptKind?: ScriptKind;
};

export const MediaScriptPage = ({ scriptKind: kindProp }: Props) => {
  const { platformId = "" } = useParams();
  const location = useLocation();
  const scriptKind: ScriptKind =
    kindProp ??
    (location.pathname.includes("collect-script") ? "collect" : "publish");
  const cmds = CMDS[scriptKind];

  const [platform, setPlatform] = useState<MediaPlatform | null>(null);
  const [draft, setDraft] = useState("");
  const [matchUrl, setMatchUrl] = useState("");
  const [changelog, setChangelog] = useState("");
  const [meta, setMeta] = useState<PublishScriptView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = async () => {
    const p = await invoke<MediaPlatform>("plugin:media_platforms|media_platform_get", {
      id: platformId,
    });
    setPlatform(p);
    const s = await invoke<PublishScriptView>(cmds.get, { platformId });
    setMeta(s);
    setDraft(s.draft_script);
    setMatchUrl(s.match_url);
    setChangelog(s.changelog);
  };

  useEffect(() => {
    if (!platformId) return;
    void load().catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformId, scriptKind]);

  const saveDraft = async () => {
    setBusy("save");
    setError("");
    setOk("");
    try {
      const s = await invoke<PublishScriptView>(cmds.save, {
        platformId,
        draftScript: draft,
        matchUrl,
        changelog,
      });
      setMeta(s);
      setOk("草稿已保存");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    setBusy("publish");
    setError("");
    setOk("");
    try {
      await invoke(cmds.save, {
        platformId,
        draftScript: draft,
        matchUrl,
        changelog,
      });
      const s = await invoke<PublishScriptView>(cmds.publish, { platformId });
      setMeta(s);
      setDraft(s.draft_script);
      setOk(cmds.okPublish(s.published_version));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    if (!window.confirm("丢弃未发布草稿，恢复为已发布内容？")) return;
    setBusy("discard");
    setError("");
    setOk("");
    try {
      const s = await invoke<PublishScriptView>(cmds.discard, { platformId });
      setMeta(s);
      setDraft(s.draft_script);
      setMatchUrl(s.match_url);
      setChangelog(s.changelog);
      setOk("已丢弃草稿");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const heading = useMemo(() => {
    if (!platform) return cmds.title;
    return `${platform.name} · ${KIND_LABEL[platform.kind] ?? platform.kind} ${cmds.title}`;
  }, [platform, cmds.title]);

  if (!platform) {
    return (
      <div className="page page-scroll">
        <div className="model-panel">
          {error ? (
            <div className="mcp-form-error">{error}</div>
          ) : (
            <p className="model-status-idle">加载中…</p>
          )}
          <Link to="/media-platforms">← 返回媒体管理</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-scroll">
      <div className="model-panel">
        <div className="model-toolbar">
          <div>
            <Link to="/media-platforms" className="media-script-back">
              ← 返回媒体管理
            </Link>
            <h2 className="media-script-title">{heading}</h2>
            <p className="media-script-meta">
              {platform.code}
              {meta?.is_published
                ? ` · 已发布 v${meta.published_version}`
                : " · 尚未发布"}
              {meta?.has_unpublished_draft ? " · 有未发布草稿" : ""}
            </p>
          </div>
          <div className="model-table__actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void discard()}
              disabled={!!busy || !meta?.has_unpublished_draft}
            >
              {busy === "discard" ? "…" : "丢弃草稿"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void saveDraft()}
              disabled={!!busy}
            >
              {busy === "save" ? "…" : "保存草稿"}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void publish()}
              disabled={!!busy}
            >
              {busy === "publish" ? "…" : "发布"}
            </button>
          </div>
        </div>

        {error && <div className="mcp-form-error">{error}</div>}
        {ok && <div className="mcp-form-ok">{ok}</div>}

        <div className="mcp-form-row">
          <label>匹配 URL（可选）</label>
          <input
            value={matchUrl}
            onChange={(e) => setMatchUrl(e.target.value)}
            placeholder={platform.inject_url || "https://…"}
          />
        </div>
        <div className="mcp-form-row">
          <label>变更说明（可选）</label>
          <input
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="本次草稿改动说明"
          />
        </div>
        <div className="mcp-form-row">
          <label>脚本（草稿）</label>
          <textarea
            className="media-script-editor"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={22}
            spellCheck={false}
            placeholder={cmds.placeholder}
          />
        </div>
      </div>
    </div>
  );
};

export const CollectScriptPage = () => <MediaScriptPage scriptKind="collect" />;
