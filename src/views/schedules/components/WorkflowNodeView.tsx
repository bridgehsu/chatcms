import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getNodePreset } from "../nodePresets";

export type FlowNodeData = {
  label: string;
  nodeType: string;
  config: Record<string, unknown>;
};

export const WorkflowNodeView = ({ data, selected }: NodeProps) => {
  const d = data as FlowNodeData;
  const preset = getNodePreset(d.nodeType);
  const isNote = d.nodeType === "note";
  const isTrigger = d.nodeType === "trigger";
  const isCondition = d.nodeType === "condition";

  return (
    <div
      className={`wf-node${selected ? " is-selected" : ""}${isNote ? " is-note" : ""}`}
      style={{ ["--wf-node-accent" as string]: preset.color }}
    >
      {!isTrigger && (
        <Handle type="target" position={Position.Left} className="wf-handle" />
      )}
      <div className="wf-node__head">
        <span className="wf-node__dot" />
        <span className="wf-node__kind">{preset.label}</span>
      </div>
      <div className="wf-node__title">{d.label || preset.label}</div>
      {isNote && typeof d.config.text === "string" && d.config.text ? (
        <div className="wf-node__hint">{d.config.text}</div>
      ) : null}
      {!isNote && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            className="wf-handle"
          />
          {isCondition && (
            <Handle
              type="source"
              position={Position.Bottom}
              id="else"
              className="wf-handle wf-handle--else"
            />
          )}
        </>
      )}
    </div>
  );
};
