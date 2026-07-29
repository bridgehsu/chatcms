import { useEffect, useMemo } from "react";
import type { GeneratedImage } from "../types";
import {
  mediaSourceLabel,
  mediaSourceOf,
  mediaUpdatedAt,
} from "../types";

type SourceFilter = "all" | "ai" | "upload" | "web";

type Props = {
  images: GeneratedImage[];
  previews: Record<string, string>;
  query: string;
  source: SourceFilter;
  page: number;
  pageSize: number;
  selected: Set<string>;
  onPageChange: (page: number) => void;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onPreview: (img: GeneratedImage) => void;
  onPublish: (img: GeneratedImage) => void;
  onEdit: (img: GeneratedImage) => void;
  onRemove: (id: string) => void;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")} ${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
};

export const ImageTable = ({
  images,
  previews,
  query,
  source,
  page,
  pageSize,
  selected,
  onPageChange,
  onToggle,
  onToggleAll,
  onPreview,
  onPublish,
  onEdit,
  onRemove,
}: Props) => {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return images.filter((img) => {
      if (source !== "all" && mediaSourceOf(img.model) !== source) return false;
      if (!q) return true;
      const note = (img.note || "").toLowerCase();
      return (
        img.prompt.toLowerCase().includes(q) ||
        note.includes(q) ||
        img.model.toLowerCase().includes(q)
      );
    });
  }, [images, query, source]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) onPageChange(safePage);
  }, [page, safePage, onPageChange]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const pageIds = pageItems.map((i) => i.id);
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const indexBase = (safePage - 1) * pageSize;

  return (
    <section className="media-lib">
      <div className="model-table-wrap">
        <table className="model-table media-lib__table">
          <thead>
            <tr>
              <th className="media-lib__check">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleAll(pageIds)}
                  aria-label="全选本页"
                />
              </th>
              <th className="model-table__idx">序号</th>
              <th className="media-lib__thumb-col">预览</th>
              <th>名称</th>
              <th>备注</th>
              <th>来源</th>
              <th>规格</th>
              <th>修改时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="model-table__empty">
                  {images.length === 0
                    ? "暂无图片，可上传或 AI 生成"
                    : "没有匹配的图片"}
                </td>
              </tr>
            ) : (
              pageItems.map((img, i) => (
                <tr key={img.id} className="model-table__row">
                  <td className="media-lib__check">
                    <input
                      type="checkbox"
                      checked={selected.has(img.id)}
                      onChange={() => onToggle(img.id)}
                      aria-label="选择"
                    />
                  </td>
                  <td className="model-table__idx model-table__mono">
                    {indexBase + i + 1}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="media-lib__thumb"
                      onClick={() => onPreview(img)}
                    >
                      {previews[img.id] ? (
                        <img src={previews[img.id]} alt="" />
                      ) : (
                        <span>…</span>
                      )}
                    </button>
                  </td>
                  <td className="media-lib__name">
                    <span className="media-lib__name-text" title={img.prompt}>
                      {img.prompt || "(未命名)"}
                    </span>
                  </td>
                  <td className="media-lib__note" title={img.note || ""}>
                    {img.note?.trim() ? img.note : "—"}
                  </td>
                  <td>
                    <span
                      className={`media-lib__src media-lib__src--${mediaSourceOf(img.model)}`}
                    >
                      {mediaSourceLabel(img.model)}
                    </span>
                  </td>
                  <td className="model-table__mono">
                    {img.size === "imported" ? "—" : img.size}
                  </td>
                  <td className="model-table__mono">
                    {formatTime(mediaUpdatedAt(img))}
                  </td>
                  <td>
                    <div className="model-table__actions">
                      <button
                        type="button"
                        className="btn-mcp-action"
                        onClick={() => onPreview(img)}
                      >
                        查看
                      </button>
                      <button
                        type="button"
                        className="btn-mcp-action"
                        onClick={() => onEdit(img)}
                      >
                        修改
                      </button>
                      <button
                        type="button"
                        className="btn-mcp-action"
                        onClick={() => onPublish(img)}
                      >
                        发布
                      </button>
                      <button
                        type="button"
                        className="btn-mcp-remove"
                        onClick={() => {
                          if (window.confirm("确定删除这张图片？")) {
                            onRemove(img.id);
                          }
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="media-lib__pager">
        <span className="media-lib__pager-info">
          共 {filtered.length} 项
          {filtered.length > 0
            ? ` · 第 ${safePage}/${totalPages} 页`
            : ""}
        </span>
        <div className="media-lib__pager-btns">
          <button
            type="button"
            className="btn-mcp-action"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            上一页
          </button>
          <button
            type="button"
            className="btn-mcp-action"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
};

export type { SourceFilter };
