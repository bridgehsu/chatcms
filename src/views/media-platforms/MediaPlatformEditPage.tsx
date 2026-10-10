import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Input, Select, Space, Switch } from "antd";
import FormSec from "@/components/FormSec";
import { invoke } from "@/hooks/useTauri";
import type { MediaPlatform, PublishScriptView } from "@/types";

const KIND_OPTIONS = [
  { label: "动态", value: "dynamic" },
  { label: "文章", value: "article" },
  { label: "视频", value: "video" },
  { label: "播客", value: "podcast" },
];

const REGION_OPTIONS = [
  { label: "国内", value: "cn" },
  { label: "海外", value: "intl" },
];

const emptyScript = (): Pick<
  PublishScriptView,
  | "draft_script"
  | "match_url"
  | "changelog"
  | "published_version"
  | "has_unpublished_draft"
  | "is_published"
> => ({
  draft_script: "",
  match_url: "",
  changelog: "",
  published_version: 0,
  has_unpublished_draft: false,
  is_published: false,
});

export const MediaPlatformEditPage = () => {
  const { platformId } = useParams();
  const isNew = !platformId || platformId === "new";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("dynamic");
  const [region, setRegion] = useState("cn");
  const [injectUrl, setInjectUrl] = useState("");
  const [homeUrl, setHomeUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [notes, setNotes] = useState("");

  const [publishDraft, setPublishDraft] = useState("");
  const [publishMatchUrl, setPublishMatchUrl] = useState("");
  const [publishChangelog, setPublishChangelog] = useState("");
  const [publishMeta, setPublishMeta] = useState(emptyScript());

  const [collectDraft, setCollectDraft] = useState("");
  const [collectMatchUrl, setCollectMatchUrl] = useState("");
  const [collectChangelog, setCollectChangelog] = useState("");
  const [collectMeta, setCollectMeta] = useState(emptyScript());

  const [savedId, setSavedId] = useState<string | null>(isNew ? null : platformId!);

  const heading = useMemo(
    () => (isNew && !savedId ? "新增插件脚本" : `编辑 · ${name || "插件脚本"}`),
    [isNew, savedId, name],
  );

  const load = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const p = await invoke<MediaPlatform>("media_platform_get", { id });
      setCode(p.code);
      setName(p.name);
      setKind(p.kind || "dynamic");
      setRegion(p.region || "cn");
      setInjectUrl(p.inject_url || "");
      setHomeUrl(p.home_url || "");
      setEnabled(p.enabled);
      setNotes(p.notes || "");
      setSavedId(p.id);

      const [pub, col] = await Promise.all([
        invoke<PublishScriptView>("publish_script_get", { platformId: id }),
        invoke<PublishScriptView>("collect_script_get", { platformId: id }),
      ]);
      setPublishDraft(pub.draft_script || "");
      setPublishMatchUrl(pub.match_url || "");
      setPublishChangelog(pub.changelog || "");
      setPublishMeta(pub);
      setCollectDraft(col.draft_script || "");
      setCollectMatchUrl(col.match_url || "");
      setCollectChangelog(col.changelog || "");
      setCollectMeta(col);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isNew) return;
    void load(platformId!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformId, isNew]);

  const upsertPlatform = async () => {
    const platform = await invoke<MediaPlatform>("media_platform_upsert", {
      id: savedId,
      code: code.trim(),
      name: name.trim(),
      kind,
      injectUrl: injectUrl.trim(),
      homeUrl: homeUrl.trim(),
      enabled,
      notes: notes.trim(),
      region,
    });
    setSavedId(platform.id);
    return platform;
  };

  const saveScripts = async (id: string) => {
    const [pub, col] = await Promise.all([
      invoke<PublishScriptView>("publish_script_save_draft", {
        platformId: id,
        draftScript: publishDraft,
        matchUrl: publishMatchUrl,
        changelog: publishChangelog,
      }),
      invoke<PublishScriptView>("collect_script_save_draft", {
        platformId: id,
        draftScript: collectDraft,
        matchUrl: collectMatchUrl,
        changelog: collectChangelog,
      }),
    ]);
    setPublishMeta(pub);
    setCollectMeta(col);
  };

  const onSave = async () => {
    if (!name.trim()) {
      setError("请填写名称");
      return;
    }
    if (!code.trim()) {
      setError("请填写编码");
      return;
    }
    setBusy("save");
    setError("");
    setOk("");
    try {
      const platform = await upsertPlatform();
      await saveScripts(platform.id);
      setOk("已保存平台与脚本草稿");
      if (isNew && platform.id) {
        navigate(`/media-platforms/${platform.id}/edit`, { replace: true });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const publishOne = async (kind: "publish" | "collect") => {
    if (!savedId) {
      setError("请先保存平台基本信息");
      return;
    }
    setBusy(kind);
    setError("");
    setOk("");
    try {
      await saveScripts(savedId);
      if (kind === "publish") {
        const s = await invoke<PublishScriptView>("publish_script_publish", {
          platformId: savedId,
        });
        setPublishMeta(s);
        setPublishDraft(s.draft_script || "");
        setOk(`填表脚本已发布为 v${s.published_version}`);
      } else {
        const s = await invoke<PublishScriptView>("collect_script_publish", {
          platformId: savedId,
        });
        setCollectMeta(s);
        setCollectDraft(s.draft_script || "");
        setOk(`采集脚本已发布为 v${s.published_version}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="page page-scroll">
        <div className="model-panel">
          <p className="model-status-idle">加载中…</p>
          <Link to="/media-platforms">← 返回插件脚本</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-scroll">
      <div className="model-panel media-platform-edit">
        <div className="model-toolbar">
          <div>
            <Link to="/media-platforms" className="media-script-back">
              ← 返回插件脚本
            </Link>
            <h2 className="media-script-title">{heading}</h2>
            <p className="media-script-meta">
              {savedId ? `ID ${savedId}` : "新建后保存将生成平台并绑定脚本"}
            </p>
          </div>
          <Space wrap>
            <Button onClick={() => navigate("/media-platforms")}>取消</Button>
            <Button
              type="primary"
              loading={busy === "save"}
              disabled={!!busy && busy !== "save"}
              onClick={() => void onSave()}
            >
              保存
            </Button>
          </Space>
        </div>

        {error ? <div className="mcp-form-error">{error}</div> : null}
        {ok ? <div className="mcp-form-ok">{ok}</div> : null}

        <FormSec title="基本信息" hint="名称与编码用于插件侧展示与桥接拉取">
          <div className="media-platform-edit__grid">
            <div className="mcp-form-row">
              <label>名称</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：BOSS直聘·打招呼"
              />
            </div>
            <div className="mcp-form-row">
              <label>编码</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="如：JOB_BOSS_GREET"
                disabled={!!savedId}
              />
            </div>
            <div className="mcp-form-row">
              <label>类型</label>
              <Select
                value={kind}
                options={KIND_OPTIONS}
                onChange={setKind}
                style={{ width: "100%" }}
              />
            </div>
            <div className="mcp-form-row">
              <label>地区</label>
              <Select
                value={region}
                options={REGION_OPTIONS}
                onChange={setRegion}
                style={{ width: "100%" }}
              />
            </div>
            <div className="mcp-form-row media-platform-edit__span2">
              <label>注入页 URL</label>
              <Input
                value={injectUrl}
                onChange={(e) => setInjectUrl(e.target.value)}
                placeholder="扩展打开并注入脚本的页面"
              />
            </div>
            <div className="mcp-form-row media-platform-edit__span2">
              <label>主页 URL</label>
              <Input
                value={homeUrl}
                onChange={(e) => setHomeUrl(e.target.value)}
                placeholder="可选"
              />
            </div>
            <div className="mcp-form-row media-platform-edit__span2">
              <label>备注</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="可选说明"
              />
            </div>
            <div className="mcp-form-row">
              <label>启用（扩展桥仅返回已启用平台）</label>
              <div>
                <Switch
                  checked={enabled}
                  onChange={setEnabled}
                  checkedChildren="启用"
                  unCheckedChildren="停用"
                />
              </div>
            </div>
          </div>
        </FormSec>

        <FormSec
          title="采集脚本"
          hint={
            collectMeta.is_published
              ? `已发布 v${collectMeta.published_version}${collectMeta.has_unpublished_draft ? " · 有未发布草稿" : ""}`
              : "尚未发布 · 保存草稿后可点「发布采集」"
          }
        >
          <div className="mcp-form-row">
            <label>匹配 URL（可选）</label>
            <Input
              value={collectMatchUrl}
              onChange={(e) => setCollectMatchUrl(e.target.value)}
              placeholder={injectUrl || "https://…"}
            />
          </div>
          <div className="mcp-form-row">
            <label>变更说明（可选）</label>
            <Input
              value={collectChangelog}
              onChange={(e) => setCollectChangelog(e.target.value)}
              placeholder="本次草稿改动说明"
            />
          </div>
          <div className="mcp-form-row">
            <label>脚本（草稿）</label>
            <textarea
              className="media-script-editor"
              value={collectDraft}
              onChange={(e) => setCollectDraft(e.target.value)}
              rows={16}
              spellCheck={false}
              placeholder="// 平台采集 JS（函数体）；仅「发布」后扩展可通过桥拉取"
            />
          </div>
          <div className="media-platform-edit__script-actions">
            <Button
              type="primary"
              ghost
              loading={busy === "collect"}
              disabled={!savedId || (!!busy && busy !== "collect")}
              onClick={() => void publishOne("collect")}
            >
              发布采集
            </Button>
          </div>
        </FormSec>

        <FormSec
          title="填表脚本"
          hint={
            publishMeta.is_published
              ? `已发布 v${publishMeta.published_version}${publishMeta.has_unpublished_draft ? " · 有未发布草稿" : ""}`
              : "尚未发布 · 保存草稿后可点「发布填表」"
          }
        >
          <div className="mcp-form-row">
            <label>匹配 URL（可选）</label>
            <Input
              value={publishMatchUrl}
              onChange={(e) => setPublishMatchUrl(e.target.value)}
              placeholder={injectUrl || "https://…"}
            />
          </div>
          <div className="mcp-form-row">
            <label>变更说明（可选）</label>
            <Input
              value={publishChangelog}
              onChange={(e) => setPublishChangelog(e.target.value)}
              placeholder="本次草稿改动说明"
            />
          </div>
          <div className="mcp-form-row">
            <label>脚本（草稿）</label>
            <textarea
              className="media-script-editor"
              value={publishDraft}
              onChange={(e) => setPublishDraft(e.target.value)}
              rows={16}
              spellCheck={false}
              placeholder={
                "// 发布填表 JS（函数体，入参 data）\n" +
                "// data: { title, content, images, isAutoPublish, platform }\n" +
                "// 仅「发布」后扩展可通过桥拉取"
              }
            />
          </div>
          <div className="media-platform-edit__script-actions">
            <Button
              type="primary"
              ghost
              loading={busy === "publish"}
              disabled={!savedId || (!!busy && busy !== "publish")}
              onClick={() => void publishOne("publish")}
            >
              发布填表
            </Button>
          </div>
        </FormSec>
      </div>
    </div>
  );
};

export default MediaPlatformEditPage;
