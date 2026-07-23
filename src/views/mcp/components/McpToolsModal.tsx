import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { McpToolDef } from "@/types";

type Props = {
  serverName: string;
  onClose: () => void;
};

export const McpToolsModal = ({ serverName, onClose }: Props) => {
  const [tools, setTools] = useState<McpToolDef[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void invoke<McpToolDef[]>("mcp_tools", { name: serverName })
      .then(setTools)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [serverName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal skill-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-tools-title"
      >
        <div className="model-modal__header">
          <h2 id="mcp-tools-title" className="model-modal__title">
            工具列表 · {serverName}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="model-modal__body">
          {loading && <p className="skill-modal__hint">加载中…</p>}
          {error && <div className="mcp-form-error">{error}</div>}
          {!loading && !error && tools.length === 0 && (
            <p className="skill-modal__hint">该服务器暂无工具（可能未连接）</p>
          )}
          <div className="mcp-tools-list">
            {tools.map((t) => (
              <div key={t.api_name} className="mcp-tools-item">
                <div className="mcp-tools-item__name">{t.name}</div>
                <div className="mcp-tools-item__api model-table__mono">
                  {t.api_name}
                </div>
                {t.description ? (
                  <div className="mcp-tools-item__desc">{t.description}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="model-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
