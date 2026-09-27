import { useEffect, useMemo, useRef, useState } from "react";
import CabinX, { type CabinXColumn } from "@/components/CabinX";
import { invoke } from "@/hooks/useTauri";
import { formatTime } from "@/utils/time";
import { PublishModal, type PublishSource } from "@/views/publish/PublishModal";
import type { GeneratedImage, SourceFilter } from "../types";
import {
  mediaSourceLabel,
  mediaSourceOf,
  mediaUpdatedAt,
} from "../types";

const SOURCE_SEARCH_OPTIONS = [
  { label: "全部来源", value: "all" },
  { label: "AI", value: "ai" },
  { label: "上传", value: "upload" },
  { label: "网页", value: "web" },
];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const i = result.indexOf(",");
      resolve(i >= 0 ? result.slice(i + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });

const emitBusy = (busy: boolean) => {
  window.dispatchEvent(
    new CustomEvent("images:topbar-busy", { detail: { busy } }),
  );
};

export const ImagesBoard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const previewsRef = useRef<Record<string, string>>({});
  const [preview, setPreview] = useState<GeneratedImage | null>(null);
  const [publishSrc, setPublishSrc] = useState<PublishSource | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    emitBusy(busy);
  }, [busy]);

  useEffect(() => {
    const onPick = () => fileRef.current?.click();
    const onRequest = () => emitBusy(busy);
    window.addEventListener("images:pick-upload", onPick);
    window.addEventListener("images:topbar-request", onRequest);
    return () => {
      window.removeEventListener("images:pick-upload", onPick);
      window.removeEventListener("images:topbar-request", onRequest);
    };
  }, [busy]);

  const ensurePreviews = async (items: GeneratedImage[]) => {
    const next = { ...previewsRef.current };
    let changed = false;
    await Promise.all(
      items.map(async (img) => {
        if (next[img.id]) return;
        try {
          next[img.id] = await invoke<string>("image_data_url", {
            path: img.path,
          });
          changed = true;
        } catch {
          /* skip broken */
        }
      }),
    );
    if (changed) {
      previewsRef.current = next;
      setPreviews(next);
    }
  };

  const api = useMemo(
    () => ({
      paging: async (params: any) => {
        void refreshKey;
        let list = await invoke<GeneratedImage[]>("image_list");
        const q = String(params?.prompt ?? "").trim().toLowerCase();
        const source = (params?.source || "all") as SourceFilter;
        if (source !== "all") {
          list = list.filter((img) => mediaSourceOf(img.model) === source);
        }
        if (q) {
          list = list.filter((img) => {
            const remark = (img.remark || "").toLowerCase();
            return (
              img.prompt.toLowerCase().includes(q) ||
              remark.includes(q) ||
              img.model.toLowerCase().includes(q)
            );
          });
        }
        list = [...list].sort(
          (a, b) => mediaUpdatedAt(b) - mediaUpdatedAt(a),
        );

        const pageNum = params?.pageNum ?? 1;
        const pageSize = params?.pageSize ?? 10;
        const start = (pageNum - 1) * pageSize;
        const pageList = list.slice(start, start + pageSize);
        await ensurePreviews(pageList);
        const withPreview = pageList.map((img) => ({
          ...img,
          _preview: previewsRef.current[img.id] || "",
        }));
        return {
          list: withPreview,
          total: list.length,
          pageNum,
          pageSize,
        };
      },
      edit: async (data: any) => {
        await invoke("image_update", {
          id: String(data.id),
          title: String(data.prompt ?? "").trim(),
          note: String(data.remark ?? ""),
        });
      },
      del: async (id: string | number) => {
        await invoke("image_delete", { id: String(id) });
        setPreviews((prev) => {
          const next = { ...prev };
          delete next[String(id)];
          return next;
        });
      },
    }),
    [refreshKey],
  );

  const onPickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(true);
    try {
      for (const file of list) {
        const dataBase64 = await fileToBase64(file);
        const item = await invoke<GeneratedImage>("image_upload", {
          dataBase64,
          filename: file.name,
          contentType: file.type || null,
        });
        try {
          const dataUrl = await invoke<string>("image_data_url", {
            path: item.path,
          });
          setPreviews((prev) => ({ ...prev, [item.id]: dataUrl }));
        } catch {
          /* ignore */
        }
      }
      setRefreshKey((k) => k + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const columns: CabinXColumn<GeneratedImage>[] = [
    {
      title: "预览",
      dataIndex: "path",
      key: "preview",
      width: 72,
      render: (_: string, record: GeneratedImage & { _preview?: string }) => (
        <button
          type="button"
          className="media-lib__thumb"
          onClick={(e) => {
            e.stopPropagation();
            setPreview(record);
          }}
        >
          {record._preview || previews[record.id] ? (
            <img src={record._preview || previews[record.id]} alt="" />
          ) : (
            <span>…</span>
          )}
        </button>
      ),
    },
    {
      title: "名称",
      dataIndex: "prompt",
      key: "prompt",
      search: {
        name: "prompt",
        label: "关键词",
        type: "input",
        placeholder: "搜索名称、备注…",
      },
      editor: {
        name: "prompt",
        label: "名称",
        type: "textarea",
        rows: 4,
        rules: [{ required: true, message: "请输入名称" }],
        placeholder: "图片名称或提示词",
      },
      render: (prompt: string, record: GeneratedImage) => (
        <>
          <span className="model-table__name" title={prompt}>
            {prompt || "(未命名)"}
          </span>
          {record.remark?.trim() ? (
            <div className="account-table__notes">{record.remark}</div>
          ) : null}
        </>
      ),
    },
    {
      title: "备注",
      dataIndex: "remark",
      key: "remark",
      hideInTable: true,
      editor: {
        name: "remark",
        label: "备注",
        type: "textarea",
        rows: 3,
        placeholder: "可选说明",
      },
    },
    {
      title: "来源",
      dataIndex: "model",
      key: "source",
      width: 88,
      search: {
        name: "source",
        label: "来源",
        type: "select",
        options: SOURCE_SEARCH_OPTIONS,
        placeholder: "全部来源",
      },
      render: (model: string) => (
        <span
          className={`media-lib__src media-lib__src--${mediaSourceOf(model)}`}
        >
          {mediaSourceLabel(model)}
        </span>
      ),
    },
    {
      title: "规格",
      dataIndex: "size",
      key: "size",
      width: 110,
      render: (size: string) => (
        <span className="model-table__mono">
          {size === "imported" ? "—" : size}
        </span>
      ),
    },
    {
      title: "修改时间",
      dataIndex: "updated",
      key: "updated",
      width: 170,
      render: (_: number, record: GeneratedImage) => (
        <span className="model-table__mono">
          {formatTime(mediaUpdatedAt(record))}
        </span>
      ),
    },
  ];

  return (
    <>
      <CabinX
        api={api}
        columns={columns}
        pageTitle="图片工厂"
        rowKey="id"
        hideTopbar
        headerActions={null}
        formType="M"
        editorWidth={480}
        editorTitle="图片"
        actionColumnWidth={120}
        formatRecordForEdit={(record: GeneratedImage) => ({
          id: record.id,
          prompt: record.prompt,
          remark: record.remark || "",
        })}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void onPickFiles(e.target.files)}
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
    </>
  );
};
