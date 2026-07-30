import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { ScheduleProject } from "@/types";

type FormState = {
  name: string;
  description: string;
  enabled: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  enabled: true,
});

const fromProject = (p: ScheduleProject): FormState => ({
  name: p.name,
  description: p.description,
  enabled: p.enabled,
});

type Props = {
  mode: "add" | "edit";
  project: ScheduleProject | null;
  onClose: () => void;
  onSaved: (created?: ScheduleProject) => Promise<void>;
};

export const ProjectModal = ({ mode, project, onClose, onSaved }: Props) => {
  const [form, setForm] = useState<FormState>(
    mode === "edit" && project ? fromProject(project) : emptyForm(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(mode === "edit" && project ? fromProject(project) : emptyForm());
    setError("");
  }, [mode, project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setError("");
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      enabled: form.enabled,
    };
    try {
      if (mode === "edit" && project) {
        await invoke("plugin:schedules|schedule_update", { id: project.id, ...payload });
        await onSaved();
      } else {
        const created = await invoke<ScheduleProject>("plugin:schedules|schedule_add", payload);
        await onSaved(created);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-project-title"
      >
        <div className="model-modal__header">
          <h2 id="schedule-project-title" className="model-modal__title">
            {mode === "edit" ? "编辑项目" : "新建调度项目"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="model-modal__body">
          <div className="mcp-form-row">
            <label>项目名称</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：每日早报推送"
              autoFocus
            />
          </div>
          <div className="mcp-form-row">
            <label>描述</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="流程用途说明"
            />
          </div>
          <label className="account-enabled">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <span>启用此项目</span>
          </label>
          {error && <div className="mcp-form-error">{error}</div>}
        </div>

        <div className="model-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={!form.name.trim() || busy}
          >
            {busy ? "保存中…" : mode === "edit" ? "保存" : "创建并打开"}
          </button>
        </div>
      </div>
    </div>
  );
};
