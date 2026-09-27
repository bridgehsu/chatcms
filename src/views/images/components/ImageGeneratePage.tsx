import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "@/layout/components/PageShell";
import { PublishModal, type PublishSource } from "@/views/publish/PublishModal";
import type { GeneratedImage } from "../types";
import { useImages } from "../hooks/useImages";
import { ImageGeneratePanel } from "./ImageGeneratePanel";

/** AI 生图独立页：左表单 · 右预览 */
export const ImageGeneratePage = () => {
  const { busy, error, setError, generate, previews } = useImages();
  const [latest, setLatest] = useState<GeneratedImage | null>(null);
  const [sessionResults, setSessionResults] = useState<GeneratedImage[]>([]);
  const [publishSrc, setPublishSrc] = useState<PublishSource | null>(null);
  const previewUrl = latest ? previews[latest.id] : "";

  return (
    <PageShell scroll={false}>
      <div className="page media-gen-split-page">
        <div className="media-gen-split">
          <aside className="media-gen-split__form" aria-label="生成设置">
            <div className={`media-gen-page__card${busy ? " is-busy" : ""}`}>
              <ImageGeneratePanel
                busy={busy}
                error={error}
                onClearError={() => setError("")}
                onGenerate={async (prompt, profileId, size) => {
                  const created = await generate(prompt, profileId, size);
                  setLatest(created);
                  setSessionResults((prev) => [
                    created,
                    ...prev.filter((i) => i.id !== created.id),
                  ]);
                }}
              />
            </div>
          </aside>

          <section className="media-gen-split__preview" aria-label="生成结果">
            {busy && !previewUrl ? (
              <div className="media-gen-split__empty media-gen-split__empty--busy">
                <span className="images-generate__spinner" aria-hidden />
                <p>正在生成…</p>
              </div>
            ) : previewUrl && latest ? (
              <div className="media-gen-split__result">
                <div className="media-gen-split__canvas">
                  {busy ? (
                    <div className="media-gen-split__busy-mask" aria-live="polite">
                      <span className="images-generate__spinner" aria-hidden />
                      <span>生成中…</span>
                    </div>
                  ) : null}
                  <img src={previewUrl} alt={latest.prompt || "生成结果"} />
                </div>
                <div className="media-gen-split__meta">
                  <p className="media-gen-split__prompt" title={latest.prompt}>
                    {latest.prompt}
                  </p>
                  <p className="media-gen-split__info">
                    {latest.model} · {latest.size.replace("x", " × ")} · 已保存
                  </p>
                  <div className="media-gen-split__actions">
                    <button
                      type="button"
                      className="btn-mcp-action"
                      onClick={() =>
                        setPublishSrc({
                          kind: "dynamic",
                          title: "",
                          content: latest.prompt,
                          imageIds: [latest.id],
                        })
                      }
                    >
                      发布
                    </button>
                    <Link className="btn-mcp-action" to="/images">
                      打开列表
                    </Link>
                  </div>
                </div>
                {sessionResults.length > 1 ? (
                  <div className="media-gen-split__thumbs" aria-label="本次生成">
                    {sessionResults.map((img) => {
                      const url = previews[img.id];
                      if (!url) return null;
                      return (
                        <button
                          key={img.id}
                          type="button"
                          className={`media-gen-split__thumb${
                            latest.id === img.id ? " is-active" : ""
                          }`}
                          onClick={() => setLatest(img)}
                          title={img.prompt}
                        >
                          <img src={url} alt="" />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="media-gen-split__empty">
                <div className="media-gen-split__empty-icon" aria-hidden>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4.5 16.5 9 12l3 3 4.5-5.5L19.5 14"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="16"
                      rx="3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                </div>
                <p className="media-gen-split__empty-title">生成结果将显示在这里</p>
                <p className="media-gen-split__empty-desc">
                  左侧填写提示词后，点顶栏「生成并保存」
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {publishSrc ? (
        <PublishModal source={publishSrc} onClose={() => setPublishSrc(null)} />
      ) : null}
    </PageShell>
  );
};
