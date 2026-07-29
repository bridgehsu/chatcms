import { useMemo, useState } from "react";
import {
  platformsForKind,
  publishMediaUrl,
  publishPlaceholderCoverUrl,
  type PublishKind,
} from "@/config/publishPlatforms";
import { invoke } from "@/hooks/useTauri";

export type PublishSource =
  | {
      kind: "dynamic";
      title?: string;
      content: string;
      imageIds: string[];
    }
  | {
      kind: "article";
      title: string;
      content: string;
    }
  | {
      kind: "video";
      title?: string;
      content: string;
      videoId: string;
    };

type Props = {
  source: PublishSource;
  onClose: () => void;
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const plainToHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");

export const PublishModal = ({ source, onClose }: Props) => {
  const options = useMemo(() => platformsForKind(source.kind), [source.kind]);
  const [title, setTitle] = useState(() => {
    if (source.kind === "article") return source.title;
    if (source.kind === "video") return source.title ?? source.content.slice(0, 40);
    return source.title ?? "";
  });
  const [content, setContent] = useState(source.content);
  const [selected, setSelected] = useState<string[]>(() =>
    options.slice(0, 2).map((o) => o.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const buildSyncData = () => {
    const platforms = selected.map((name) => ({ name }));
    const kind: PublishKind = source.kind;
    if (kind === "dynamic" && source.kind === "dynamic") {
      return {
        platforms,
        isAutoPublish: false,
        data: {
          title: title.trim(),
          content: content.trim(),
          images: source.imageIds.map((id, i) => ({
            name: `image-${i + 1}.png`,
            url: publishMediaUrl("image", id),
            type: "image/png",
          })),
          videos: [],
        },
      };
    }
    if (kind === "video" && source.kind === "video") {
      return {
        platforms,
        isAutoPublish: false,
        data: {
          title: title.trim() || "未命名视频",
          content: content.trim(),
          video: {
            name: "video.mp4",
            url: publishMediaUrl("video", source.videoId),
            type: "video/mp4",
          },
        },
      };
    }
    // article
    const md = content.trim();
    return {
      platforms,
      isAutoPublish: false,
      data: {
        title: title.trim() || "无标题",
        digest: md.slice(0, 120),
        cover: {
          name: "cover.png",
          url: publishPlaceholderCoverUrl(),
          type: "image/png",
        },
        htmlContent: plainToHtml(md),
        markdownContent: md,
      },
    };
  };

  const submit = async () => {
    setError("");
    setOkMsg("");
    if (selected.length === 0) {
      setError("请至少选择一个平台");
      return;
    }
    if (!content.trim() && source.kind !== "dynamic") {
      setError("请填写正文");
      return;
    }
    if (source.kind === "dynamic" && !content.trim() && source.imageIds.length === 0) {
      setError("请填写文案或确保已有图片");
      return;
    }
    setBusy(true);
    try {
      const url = await invoke<string>("publish_to_browser", {
        syncData: buildSyncData(),
      });
      setOkMsg(`已打开浏览器桥接页：${url}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal skill-modal publish-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="publish-modal-title" className="model-modal__title">
            发布到浏览器
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="model-modal__body">
          <p className="skill-modal__hint">
            通过浏览器插件自动填充各平台创作者页（不自动点发布）。请先安装
            chatcms-extesion，并在浏览器登录目标账号。
          </p>

          <div className="mcp-form-row">
            <label>标题</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="可选标题"
            />
          </div>

          <div className="mcp-form-row">
            <label>正文 / 文案</label>
            <textarea
              className="publish-modal__content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="将自动填入平台编辑器"
            />
          </div>

          <div className="mcp-form-row">
            <label>目标平台</label>
            <div className="publish-modal__platforms">
              {options.map((o) => (
                <label key={o.id} className="publish-modal__chip">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={() => toggle(o.id)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error ? <div className="mcp-form-error">{error}</div> : null}
          {okMsg ? <div className="mcp-form-ok">{okMsg}</div> : null}
        </div>

        <div className="model-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            关闭
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "打开中…" : "打开浏览器填表"}
          </button>
        </div>
      </div>
    </div>
  );
};
