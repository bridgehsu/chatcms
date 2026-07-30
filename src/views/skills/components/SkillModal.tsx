import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { Skill } from "@/types";

type FormState = {
  name: string;
  description: string;
  body: string;
  enabled: boolean;
  userInvocable: boolean;
  disableModelInvocation: boolean;
  homepage: string;
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  body: `# 技能标题

## 何时使用

…

## 步骤

1. …
`,
  enabled: true,
  userInvocable: true,
  disableModelInvocation: false,
  homepage: "",
});

const fromSkill = (s: Skill): FormState => ({
  name: s.name,
  description: s.description,
  body: s.body,
  enabled: s.enabled,
  userInvocable: s.user_invocable,
  disableModelInvocation: s.disable_model_invocation,
  homepage: s.homepage ?? "",
});

type Props = {
  mode: "add" | "edit";
  skill: Skill | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const SkillModal = ({ mode, skill, onClose, onSaved }: Props) => {
  const [form, setForm] = useState<FormState>(
    mode === "edit" && skill ? fromSkill(skill) : emptyForm(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setForm(mode === "edit" && skill ? fromSkill(skill) : emptyForm());
    setError("");
    setPreview(false);
  }, [mode, skill]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const skillMdPreview = () => {
    let fm = `---\nname: ${form.name.trim() || "my-skill"}\ndescription: "${form.description.replace(/"/g, '\\"')}"\n`;
    if (!form.userInvocable) fm += "user-invocable: false\n";
    if (form.disableModelInvocation) fm += "disable-model-invocation: true\n";
    if (form.homepage.trim()) fm += `homepage: ${form.homepage.trim()}\n`;
    fm += "---\n\n";
    return fm + form.body.trim() + "\n";
  };

  const save = async () => {
    setError("");
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      body: form.body,
      enabled: form.enabled,
      userInvocable: form.userInvocable,
      disableModelInvocation: form.disableModelInvocation,
      homepage: form.homepage.trim() || null,
      metadata: skill?.metadata ?? null,
    };
    try {
      if (mode === "edit" && skill) {
        await invoke("plugin:skills|skill_update", { id: skill.id, ...payload });
      } else {
        await invoke("plugin:skills|skill_add", payload);
      }
      await onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="model-modal skill-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="skill-modal-title" className="model-modal__title">
            {mode === "edit" ? "编辑技能" : "新建技能"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="model-modal__body">
          <p className="skill-modal__hint">
            对齐 OpenClaw AgentSkills：一份{" "}
            <code>SKILL.md</code>（YAML frontmatter + Markdown 正文）
          </p>

          {!preview ? (
            <>
              <div className="mcp-form-row">
                <label>名称（slug）</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="content-publish"
                  disabled={mode === "edit" && skill?.source === "bundled"}
                />
              </div>
              <div className="mcp-form-row">
                <label>描述（触发条件，一行）</label>
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="何时应使用该技能…"
                />
              </div>
              <div className="mcp-form-row">
                <label>正文（SKILL.md body）</label>
                <textarea
                  className="skill-body"
                  rows={12}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="# 标题与步骤…"
                />
              </div>
              <div className="mcp-form-row">
                <label>主页（可选）</label>
                <input
                  value={form.homepage}
                  onChange={(e) => setForm({ ...form, homepage: e.target.value })}
                  placeholder="https://"
                />
              </div>
              <div className="skill-toggles">
                <label className="account-enabled">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) =>
                      setForm({ ...form, enabled: e.target.checked })
                    }
                  />
                  <span>启用</span>
                </label>
                <label className="account-enabled">
                  <input
                    type="checkbox"
                    checked={form.userInvocable}
                    onChange={(e) =>
                      setForm({ ...form, userInvocable: e.target.checked })
                    }
                  />
                  <span>用户可调用</span>
                </label>
                <label className="account-enabled">
                  <input
                    type="checkbox"
                    checked={form.disableModelInvocation}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        disableModelInvocation: e.target.checked,
                      })
                    }
                  />
                  <span>不注入模型提示词</span>
                </label>
              </div>
            </>
          ) : (
            <pre className="skill-md-preview">{skillMdPreview()}</pre>
          )}

          {error && <div className="mcp-form-error">{error}</div>}
        </div>

        <div className="model-modal__footer">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setPreview((v) => !v)}
          >
            {preview ? "返回编辑" : "预览 SKILL.md"}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={!form.name.trim() || !form.description.trim() || busy}
          >
            {busy ? "保存中…" : mode === "edit" ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
};
