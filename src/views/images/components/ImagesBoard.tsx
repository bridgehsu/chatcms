import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Select } from "@/components/Select";
import { PublishModal, type PublishSource } from "@/views/publish/PublishModal";
import type { GeneratedImage } from "../types";
import { useImages } from "../hooks/useImages";
import { ImageTable, type SourceFilter } from "./ImageTable";
import { MediaEditModal } from "./MediaEditModal";

const PAGE_SIZE = 10;

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "ai", label: "AI" },
  { value: "upload", label: "上传" },
  { value: "web", label: "网页" },
];

export const ImagesBoard = () => {
  const navigate = useNavigate();
  const {
    images,
    previews,
    busy,
    error,
    uploadFiles,
    updateMeta,
    remove,
    removeMany,
  } = useImages();
  const [preview, setPreview] = useState<GeneratedImage | null>(null);
  const [editing, setEditing] = useState<GeneratedImage | null>(null);
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
              aria-label="搜索图片"
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
                  window.confirm(`确定删除选中的 ${selected.size} 张图片？`)
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
            className="model-btn-add"
            disabled={busy}
            onClick={() => navigate("/images/generate")}
          >
            AI 生成
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void onPickFiles(e.target.files)}
          />
        </div>
      </div>

      {error && <div className="mcp-form-error">{error}</div>}

      <ImageTable
        images={images}
        previews={previews}
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
        onPublish={(img) =>
          setPublishSrc({
            kind: "dynamic",
            title: "",
            content: img.prompt,
            imageIds: [img.id],
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
                      kind: "dynamic",
                      content: preview.prompt,
                      imageIds: [preview.id],
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
