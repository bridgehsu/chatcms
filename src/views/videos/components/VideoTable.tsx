import { useEffect, useMemo } from "react";
import type { GeneratedVideo } from "../types";
import {
  mediaSourceLabel,
  mediaSourceOf,
  mediaUpdatedAt,
} from "../types";
import type { SourceFilter } from "../../images/components/ImageTable";

type Props = {
  videos: GeneratedVideo[];
  srcFor: (path: string) => string;
  query: string;
  source: SourceFilter;
  page: number;
  pageSize: number;
  selected: Set<string>;
  onPageChange: (page: number) => void;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onPreview: (v: GeneratedVideo) => void;
  onPublish: (v: GeneratedVideo) => void;
  onEdit: (v: GeneratedVideo) => void;
  onRemove: (id: string) => void;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")} ${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
};

export const VideoTable = ({
  videos,
  srcFor,
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
    return videos.filter((v) => {
      if (source !== "all" && mediaSourceOf(v.model) !== source) return false;
      if (!q) return true;
      const remark = (v.remark || "").toLowerCase();
      return (
        v.prompt.toLowerCase().includes(q) ||
        remark.includes(q) ||
        v.model.toLowerCase().includes(q)
      );
    });
  }, [videos, query, source]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) onPageChange(safePage);
  }, [page, safePage, onPageChange]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const pageIds = pageItems.map((v) => v.id);
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
                  {videos.length === 0
                    ? "暂无视频，可上传或 AI 生成"
                    : "没有匹配的视频"}
                </td>
              </tr>
            ) : (
              pageItems.map((v, i) => (
                <tr key={v.id} className="model-table__row">
                  <td className="media-lib__check">
                    <input
                      type="checkbox"
                      checked={selected.has(v.id)}
                      onChange={() => onToggle(v.id)}
                      aria-label="选择"
                    />
                  </td>
                  <td className="model-table__idx model-table__mono">
                    {indexBase + i + 1}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="media-lib__thumb media-lib__thumb--video"
                      onClick={() => onPreview(v)}
                    >
                      {srcFor(v.path) ? (
                        <video src={srcFor(v.path)} muted preload="metadata" />
                      ) : (
                        <span>▶</span>
                      )}
                    </button>
                  </td>
                  <td className="media-lib__name">
                    <span className="media-lib__name-text" title={v.prompt}>
                      {v.prompt || "(未命名)"}
                    </span>
                  </td>
                  <td className="media-lib__note" title={v.remark || ""}>
                    {v.remark?.trim() ? v.remark : "—"}
                  </td>
                  <td>
                    <span
                      className={`media-lib__src media-lib__src--${mediaSourceOf(v.model)}`}
                    >
                      {mediaSourceLabel(v.model)}
                    </span>
                  </td>
                  <td className="model-table__mono">
                    {[
                      v.size === "imported" ? null : v.size,
                      v.seconds ? `${v.seconds}s` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="model-table__mono">
                    {formatTime(mediaUpdatedAt(v))}
                  </td>
                  <td>
                    <div className="model-table__actions">
                      <button
                        type="button"
                        className="btn-mcp-action"
                        onClick={() => onPreview(v)}
                      >
                        播放
                      </button>
                      <button
                        type="button"
                        className="btn-mcp-action"
                        onClick={() => onEdit(v)}
                      >
                        修改
                      </button>
                      <button
                        type="button"
                        className="btn-mcp-action"
                        onClick={() => onPublish(v)}
                      >
                        发布
                      </button>
                      <button
                        type="button"
                        className="btn-mcp-remove"
                        onClick={() => {
                          if (window.confirm("确定删除这段视频？")) {
                            onRemove(v.id);
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
