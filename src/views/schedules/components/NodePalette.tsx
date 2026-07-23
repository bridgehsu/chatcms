import { NODE_PRESETS } from "../nodePresets";
import type { WorkflowNodeType } from "@/types";

type Props = {
  onAdd: (type: WorkflowNodeType) => void;
};

export const NodePalette = ({ onAdd }: Props) => (
  <aside className="wf-palette">
    <div className="wf-palette__title">节点</div>
    <p className="wf-palette__desc">点击添加到画布</p>
    <div className="wf-palette__list">
      {NODE_PRESETS.map((p) => (
        <button
          key={p.type}
          type="button"
          className="wf-palette__item"
          style={{ ["--wf-node-accent" as string]: p.color }}
          onClick={() => onAdd(p.type)}
        >
          <span className="wf-palette__dot" />
          <span className="wf-palette__meta">
            <span className="wf-palette__name">{p.label}</span>
            <span className="wf-palette__hint">{p.description}</span>
          </span>
        </button>
      ))}
    </div>
  </aside>
);
