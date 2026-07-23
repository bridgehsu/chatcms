import { getNodePreset } from "../nodePresets";
import type { FlowNodeData } from "./WorkflowNodeView";

type Props = {
  nodeId: string | null;
  data: FlowNodeData | null;
  onChange: (nodeId: string, patch: Partial<FlowNodeData>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
};

export const NodeInspector = ({
  nodeId,
  data,
  onChange,
  onDelete,
  onClose,
}: Props) => {
  if (!nodeId || !data) {
    return (
      <aside className="wf-inspector wf-inspector--empty">
        <p>选中节点后可在此编辑属性</p>
      </aside>
    );
  }

  const preset = getNodePreset(data.nodeType);
  const cfg = data.config ?? {};

  const setConfig = (key: string, value: unknown) => {
    onChange(nodeId, {
      config: { ...cfg, [key]: value },
    });
  };

  return (
    <aside className="wf-inspector">
      <div className="wf-inspector__header">
        <div>
          <div className="wf-inspector__kind">{preset.label}</div>
          <div className="wf-inspector__title">节点属性</div>
        </div>
        <button type="button" className="model-modal__close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="wf-inspector__body">
        <div className="mcp-form-row">
          <label>显示名称</label>
          <input
            value={data.label}
            onChange={(e) => onChange(nodeId, { label: e.target.value })}
          />
        </div>

        {data.nodeType === "trigger" && (
          <>
            <div className="mcp-form-row">
              <label>触发方式</label>
              <select
                value={String(cfg.mode ?? "cron")}
                onChange={(e) => setConfig("mode", e.target.value)}
              >
                <option value="cron">定时 Cron</option>
                <option value="manual">手动</option>
              </select>
            </div>
            {cfg.mode !== "manual" && (
              <div className="mcp-form-row">
                <label>Cron 表达式</label>
                <input
                  value={String(cfg.cron ?? "")}
                  onChange={(e) => setConfig("cron", e.target.value)}
                  placeholder="0 9 * * *"
                />
              </div>
            )}
            <div className="mcp-form-row">
              <label>说明</label>
              <input
                value={String(cfg.note ?? "")}
                onChange={(e) => setConfig("note", e.target.value)}
              />
            </div>
          </>
        )}

        {data.nodeType === "agent" && (
          <div className="mcp-form-row">
            <label>提示词</label>
            <textarea
              rows={5}
              value={String(cfg.prompt ?? "")}
              onChange={(e) => setConfig("prompt", e.target.value)}
              placeholder="写入要让 Agent 执行的任务…"
            />
          </div>
        )}

        {data.nodeType === "http" && (
          <>
            <div className="mcp-form-row">
              <label>方法</label>
              <select
                value={String(cfg.method ?? "POST")}
                onChange={(e) => setConfig("method", e.target.value)}
              >
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="mcp-form-row">
              <label>URL</label>
              <input
                value={String(cfg.url ?? "")}
                onChange={(e) => setConfig("url", e.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="mcp-form-row">
              <label>Body</label>
              <textarea
                rows={4}
                value={String(cfg.body ?? "")}
                onChange={(e) => setConfig("body", e.target.value)}
              />
            </div>
          </>
        )}

        {data.nodeType === "publish" && (
          <>
            <div className="mcp-form-row">
              <label>平台</label>
              <input
                value={String(cfg.platform ?? "")}
                onChange={(e) => setConfig("platform", e.target.value)}
                placeholder="xiaohongshu / douyin …"
              />
            </div>
            <div className="mcp-form-row">
              <label>账号 ID</label>
              <input
                value={String(cfg.accountId ?? "")}
                onChange={(e) => setConfig("accountId", e.target.value)}
                placeholder="关联账号管理中的账号"
              />
            </div>
            <div className="mcp-form-row">
              <label>内容模板</label>
              <textarea
                rows={4}
                value={String(cfg.content ?? "")}
                onChange={(e) => setConfig("content", e.target.value)}
              />
            </div>
          </>
        )}

        {data.nodeType === "condition" && (
          <div className="mcp-form-row">
            <label>条件表达式</label>
            <input
              value={String(cfg.expression ?? "")}
              onChange={(e) => setConfig("expression", e.target.value)}
              placeholder="例如：status == ok"
            />
          </div>
        )}

        {data.nodeType === "delay" && (
          <div className="mcp-form-row">
            <label>延时（秒）</label>
            <input
              type="number"
              min={1}
              value={Number(cfg.seconds ?? 60)}
              onChange={(e) => setConfig("seconds", Number(e.target.value) || 1)}
            />
          </div>
        )}

        {data.nodeType === "note" && (
          <div className="mcp-form-row">
            <label>备注内容</label>
            <textarea
              rows={5}
              value={String(cfg.text ?? "")}
              onChange={(e) => setConfig("text", e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="wf-inspector__footer">
        <button
          type="button"
          className="btn-mcp-remove"
          onClick={() => onDelete(nodeId)}
        >
          删除节点
        </button>
      </div>
    </aside>
  );
};
