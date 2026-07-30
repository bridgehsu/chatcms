import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { invoke } from "@/hooks/useTauri";
import type {
  ScheduleProject,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeType,
} from "@/types";
import { getNodePreset } from "../nodePresets";
import { NodeInspector } from "./NodeInspector";
import { NodePalette } from "./NodePalette";
import { WorkflowNodeView, type FlowNodeData } from "./WorkflowNodeView";

const nodeTypes = { workflow: WorkflowNodeView };

const toFlowNodes = (nodes: WorkflowNode[]): Node<FlowNodeData>[] =>
  nodes.map((n) => ({
    id: n.id,
    type: "workflow",
    position: { x: n.x, y: n.y },
    data: {
      label: n.label,
      nodeType: n.type,
      config: (n.data ?? {}) as Record<string, unknown>,
    },
  }));

const toFlowEdges = (edges: WorkflowEdge[]): Edge[] =>
  edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.source_handle ?? undefined,
    targetHandle: e.target_handle ?? undefined,
  }));

const fromFlow = (
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): WorkflowGraph => ({
  nodes: nodes.map((n) => ({
    id: n.id,
    type: n.data.nodeType,
    label: n.data.label,
    x: n.position.x,
    y: n.position.y,
    data: n.data.config ?? {},
  })),
  edges: edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    source_handle: e.sourceHandle ?? null,
    target_handle: e.targetHandle ?? null,
  })),
});

type CanvasProps = {
  project: ScheduleProject;
  onSaved: (project: ScheduleProject) => void;
  onDirtyChange: (dirty: boolean) => void;
};

const WorkflowCanvasInner = ({
  project,
  onSaved,
  onDirtyChange,
}: CanvasProps) => {
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(
    toFlowNodes(project.workflow?.nodes ?? []),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toFlowEdges(project.workflow?.edges ?? []),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setNodes(toFlowNodes(project.workflow?.nodes ?? []));
    setEdges(toFlowEdges(project.workflow?.edges ?? []));
    setSelectedId(null);
    setDirty(false);
    onDirtyChange(false);
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = useCallback(() => {
    setDirty(true);
    onDirtyChange(true);
  }, [onDirtyChange]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, id: `e_${crypto.randomUUID()}` }, eds));
      markDirty();
    },
    [setEdges, markDirty],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedId(params.nodes[0]?.id ?? null);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const addNode = (type: WorkflowNodeType) => {
    const preset = getNodePreset(type);
    const pos = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const id = `n_${crypto.randomUUID()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "workflow",
        position: { x: pos.x - 90, y: pos.y - 40 },
        data: {
          label: preset.label,
          nodeType: type,
          config: { ...preset.defaultData },
        },
      },
    ]);
    setSelectedId(id);
    markDirty();
  };

  const patchNode = (nodeId: string, patch: Partial<FlowNodeData>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                ...patch,
                config: patch.config ?? n.data.config,
              },
            }
          : n,
      ),
    );
    markDirty();
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
    );
    setSelectedId(null);
    markDirty();
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const workflow = fromFlow(nodes, edges);
      const updated = await invoke<ScheduleProject>("plugin:schedules|schedule_save_workflow", {
        id: project.id,
        workflow,
      });
      setDirty(false);
      onDirtyChange(false);
      onSaved(updated);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wf-shell">
      <NodePalette onAdd={addNode} />
      <div className="wf-canvas">
        <div className="wf-toolbar">
          <div className="wf-toolbar__hint">
            拖拽节点 · 从右侧圆点连线 · {dirty ? "有未保存更改" : "已保存"}
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={busy || !dirty}
          >
            {busy ? "保存中…" : "保存工作流"}
          </button>
        </div>
        {error && <div className="mcp-form-error wf-error">{error}</div>}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => {
            onNodesChange(changes);
            if (
              changes.some(
                (c) =>
                  c.type === "position" ||
                  c.type === "remove" ||
                  c.type === "add",
              )
            ) {
              markDirty();
            }
          }}
          onEdgesChange={(changes) => {
            onEdgesChange(changes);
            if (changes.some((c) => c.type === "remove" || c.type === "add")) {
              markDirty();
            }
          }}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
      <NodeInspector
        nodeId={selectedId}
        data={selectedNode?.data ?? null}
        onChange={patchNode}
        onDelete={deleteNode}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
};

type Props = {
  project: ScheduleProject;
  onSaved: (project: ScheduleProject) => void;
  onDirtyChange: (dirty: boolean) => void;
};

export const WorkflowCanvas = (props: Props) => (
  <ReactFlowProvider>
    <WorkflowCanvasInner {...props} />
  </ReactFlowProvider>
);
