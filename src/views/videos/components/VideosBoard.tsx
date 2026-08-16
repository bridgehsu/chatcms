import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Select } from "@/components/Select";
import { PublishModal, type PublishSource } from "@/views/publish/PublishModal";
import { MediaEditModal } from "../../images/components/MediaEditModal";
import type { SourceFilter } from "../../images/components/ImageTable";
import type { GeneratedVideo } from "../types";
import { useVideos } from "../hooks/useVideos";
import { VideoTable } from "./VideoTable";

const PAGE_SIZE = 10;

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "ai", label: "AI" },
  { value: "upload", label: "上传" },
  { value: "web", label: "网页" },
];

export const VideosBoard = () => {
  const navigate = useNavigate();
  const {
    videos,
    busy,
    error,
    uploadFiles,
    updateMeta,
    remove,
    removeMany,
    srcFor,
  } = useVideos();
  const [preview, setPreview] = useState<GeneratedVideo | null>(null);
  const [editing, setEditing] = useState<GeneratedVideo | null>(null);
  const [publishSrc, setPublishSrc] = useState<PublishSource | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPage(1);
  }, [query, source]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (ids: string[]) => {
    setSelected((prev) => {
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allOn) {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      await uploadFiles(files);
    } catch {
      /* error in hook */
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="model-panel media-board">
      <div className="model-toolbar">
        <div className="model-filters">
          <div className="model-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索名称、备注…"
              aria-label="搜索视频"
            />
          </div>
          <Select
            aria-label="来源筛选"
            className="media-board__source"
            value={source}
            options={SOURCE_OPTIONS}
            onChange={setSource}
          />
        </div>
        <div className="media-board__actions">
          {selected.size > 0 && (
            <button
              type="button"
              className="btn-mcp-remove"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(`确定删除选中的 ${selected.size} 个视频？`)
                ) {
                  const ids = [...selected];
                  void removeMany(ids).then(() => setSelected(new Set()));
                }
              }}
            >
              删除选中 ({selected.size})
            </button>
          )}
          <button
            type="button"
            className="btn-mcp-action"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "处理中…" : "上传"}
          </button>
          <button
            type="button"
            className="btn-mcp-action"
            disabled={busy}
            onClick={() => navigate("/videos/studio")}
          >
            视频工程
          </button>
          <button
            type="button"
            className="model-btn-add"
            disabled={busy}
            onClick={() => navigate("/videos/generate")}
          >
            AI 生成
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            multiple
            hidden
            onChange={(e) => void onPickFiles(e.target.files)}
          />
        </div>
      </div>

      {error && <div className="mcp-form-error">{error}</div>}

      <VideoTable
        videos={videos}
        srcFor={srcFor}
        query={query}
        source={source}
        page={page}
        pageSize={PAGE_SIZE}
        selected={selected}
        onPageChange={setPage}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onPreview={setPreview}
        onEdit={setEditing}
        onPublish={(v) =>
          setPublishSrc({
            kind: "video",
            title: "",
            content: v.prompt,
            videoId: v.id,
          })
        }
        onRemove={(id) => {
          void remove(id);
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }}
      />

      {editing && (
        <MediaEditModal
          title={editing.prompt}
          note={editing.remark || ""}
          onClose={() => setEditing(null)}
          onSave={async (title, note) => {
            await updateMeta(editing.id, title, note);
          }}
        />
      )}

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
              {preview.remark?.trim() ? (
                <p className="images-preview__prompt">{preview.remark}</p>
              ) : null}
              <p className="images-preview__path">{preview.path}</p>
              <div className="images-card__actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setPublishSrc({
                      kind: "video",
                      content: preview.prompt,
                      videoId: preview.id,
                    });
                    setPreview(null);
                  }}
                >
                  发布到浏览器
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {publishSrc ? (
        <PublishModal source={publishSrc} onClose={() => setPublishSrc(null)} />
      ) : null}
    </div>
  );
};
