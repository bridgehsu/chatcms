import { useState } from "react";
import type { GeneratedVideo } from "../types";
import { useVideos } from "../hooks/useVideos";
import { VideoGallery } from "./VideoGallery";
import { VideoGeneratePanel } from "./VideoGeneratePanel";

export const VideosBoard = () => {
  const { videos, busy, error, setError, generate, remove, srcFor } = useVideos();
  const [preview, setPreview] = useState<GeneratedVideo | null>(null);

  return (
    <div className="images-board">
      <VideoGeneratePanel
        busy={busy}
        error={error}
        onClearError={() => setError("")}
        onGenerate={async (prompt, model, size, seconds) => {
          await generate(prompt, model, size, seconds);
        }}
      />

      <VideoGallery
        videos={videos}
        srcFor={srcFor}
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
              <h3 className="images-preview__title">视频预览</h3>
              <button
                type="button"
                className="model-modal__close"
                onClick={() => setPreview(null)}
              >
                ×
              </button>
            </div>
            <div className="images-preview__body">
              {srcFor(preview.path) ? (
                <video
                  className="videos-preview__player"
                  src={srcFor(preview.path)}
                  controls
                  autoPlay
                />
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
