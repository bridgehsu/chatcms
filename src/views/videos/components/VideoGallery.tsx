import type { GeneratedVideo } from "../types";

type Props = {
  videos: GeneratedVideo[];
  srcFor: (path: string) => string;
  onRemove: (id: string) => void;
  onPreview: (video: GeneratedVideo) => void;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")} ${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
};

export const VideoGallery = ({ videos, srcFor, onRemove, onPreview }: Props) => (
  <section className="images-gallery">
    <header className="images-gallery__head">
      <h2 className="images-gallery__title">已保存视频</h2>
      <span className="images-gallery__count">{videos.length}</span>
    </header>

    {videos.length === 0 ? (
      <p className="images-gallery__empty">还没有视频，先在上方生成一段吧</p>
    ) : (
      <div className="images-gallery__grid">
        {videos.map((v) => {
          const src = srcFor(v.path);
          return (
            <article key={v.id} className="images-card">
              <button
                type="button"
                className="images-card__thumb videos-card__thumb"
                onClick={() => onPreview(v)}
              >
                {src ? (
                  <video src={src} muted playsInline preload="metadata" />
                ) : (
                  <span className="images-card__placeholder">无法预览</span>
                )}
              </button>
              <div className="images-card__body">
                <p className="images-card__prompt" title={v.prompt}>
                  {v.prompt}
                </p>
                <div className="images-card__meta">
                  <span>{v.model}</span>
                  <span>{v.size}</span>
                  <span>{v.seconds}s</span>
                  <span>{formatTime(v.created_at)}</span>
                </div>
                <div className="images-card__actions">
                  <button type="button" className="btn-mcp-action" onClick={() => onPreview(v)}>
                    播放
                  </button>
                  <button
                    type="button"
                    className="btn-mcp-remove"
                    onClick={() => void onRemove(v.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    )}
  </section>
);
