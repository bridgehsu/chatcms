import type { GeneratedImage } from "../types";

type Props = {
  images: GeneratedImage[];
  previews: Record<string, string>;
  onRemove: (id: string) => void;
  onPreview: (img: GeneratedImage) => void;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")} ${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
};

export const ImageGallery = ({ images, previews, onRemove, onPreview }: Props) => (
  <section className="images-gallery">
    <header className="images-gallery__head">
      <h2 className="images-gallery__title">已保存图片</h2>
      <span className="images-gallery__count">{images.length}</span>
    </header>

    {images.length === 0 ? (
      <p className="images-gallery__empty">还没有图片，先在上方生成一张吧</p>
    ) : (
      <div className="images-gallery__grid">
        {images.map((img) => (
          <article key={img.id} className="images-card">
            <button
              type="button"
              className="images-card__thumb"
              onClick={() => onPreview(img)}
            >
              {previews[img.id] ? (
                <img src={previews[img.id]} alt={img.prompt} />
              ) : (
                <span className="images-card__placeholder">加载中…</span>
              )}
            </button>
            <div className="images-card__body">
              <p className="images-card__prompt" title={img.prompt}>
                {img.prompt}
              </p>
              <div className="images-card__meta">
                <span>{img.model}</span>
                <span>{img.size}</span>
                <span>{formatTime(img.created_at)}</span>
              </div>
              <div className="images-card__actions">
                <button type="button" className="btn-mcp-action" onClick={() => onPreview(img)}>
                  查看
                </button>
                <button
                  type="button"
                  className="btn-mcp-remove"
                  onClick={() => void onRemove(img.id)}
                >
                  删除
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
);
