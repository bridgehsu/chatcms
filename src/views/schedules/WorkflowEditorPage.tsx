import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { invoke } from "@/hooks/useTauri";
import type { ScheduleProject } from "@/types";
import { WorkflowCanvas } from "./components/WorkflowCanvas";

export const WorkflowEditorPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ScheduleProject | null>(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setError("");
    void invoke<ScheduleProject>("plugin:schedules|schedule_get", { id: projectId })
      .then(setProject)
      .catch((e) => setError(String(e)));
  }, [projectId]);

  if (error) {
    return (
      <div className="page page-scroll">
        <div className="model-panel">
          <div className="mcp-form-error">{error}</div>
          <Link className="wf-back" to="/schedules">
            ← 返回任务调度
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page">
        <div className="wf-loading">加载工作流…</div>
      </div>
    );
  }

  return (
    <div className="page page-workflow">
      <div className="wf-editor-bar">
        <Link className="wf-back" to="/schedules">
          ← 任务调度
        </Link>
        <div className="wf-editor-bar__meta">
          <h1 className="wf-editor-bar__title">{project.name}</h1>
          {project.description ? (
            <p className="wf-editor-bar__desc">{project.description}</p>
          ) : null}
        </div>
        <span className={`wf-dirty${dirty ? " is-dirty" : ""}`}>
          {dirty ? "未保存" : "已同步"}
        </span>
      </div>
      <WorkflowCanvas
        project={project}
        onSaved={setProject}
        onDirtyChange={setDirty}
      />
    </div>
  );
};
