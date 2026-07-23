import { useState } from "react";
import type { GeneratedImage } from "../types";
import { useImages } from "../hooks/useImages";
import { ImageGallery } from "./ImageGallery";
import { ImageGeneratePanel } from "./ImageGeneratePanel";

export const ImagesBoard = () => {
  const { images, previews, busy, error, setError, generate, remove } = useImages();
  const [preview, setPreview] = useState<GeneratedImage | null>(null);

  return (
    <div className="images-board">
      <ImageGeneratePanel
        busy={busy}
        error={error}
        onClearError={() => setError("")}
        onGenerate={async (prompt, model, size) => {
          await generate(prompt, model, size);
        }}
      />

      <ImageGallery
        images={images}
        previews={previews}
        onRemove={(id) => void remove(id)}
        onPreview={setPreview}
      />

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div
            className="images-preview"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="images-preview__head">
              <h3 className="images-preview__title">图片预览</h3>
              <button
                type="button"
                className="model-modal__close"
                onClick={() => setPreview(null)}
              >
                ×
              </button>
            </div>
            <div className="images-preview__body">
              {previews[preview.id] ? (
                <img src={previews[preview.id]} alt={preview.prompt} />
              ) : (
                <p>无法加载预览</p>
              )}
              <p className="images-preview__prompt">{preview.prompt}</p>
              <p className="images-preview__path">{preview.path}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
