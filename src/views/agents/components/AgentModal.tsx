import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { AgentProfile, Skill } from "@/types";

type SkillsMode = "all" | "none" | "allowlist";

type FormState = {
  slug: string;
  name: string;
  description: string;
  systemPrompt: string;
  emoji: string;
  enabled: boolean;
  skillsMode: SkillsMode;
  skills: string[];
  allowAsSubagent: boolean;
};

const emptyForm = (): FormState => ({
  slug: "",
  name: "",
  description: "",
  systemPrompt: "",
  emoji: "",
  enabled: true,
  skillsMode: "all",
  skills: [],
  allowAsSubagent: true,
});

const fromAgent = (a: AgentProfile): FormState => {
  let skillsMode: SkillsMode = "all";
  if (a.skills !== null) {
    skillsMode = a.skills.length === 0 ? "none" : "allowlist";
  }
  return {
    slug: a.slug,
    name: a.name,
    description: a.description,
    systemPrompt: a.system_prompt,
    emoji: a.emoji,
    enabled: a.enabled,
    skillsMode,
    skills: a.skills ?? [],
    allowAsSubagent: a.allow_as_subagent,
  };
};

const toSkillsPayload = (form: FormState): string[] | null => {
  if (form.skillsMode === "all") return null;
  if (form.skillsMode === "none") return [];
  return form.skills;
};

type Props = {
  mode: "add" | "edit";
  agent: AgentProfile | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export const AgentModal = ({ mode, agent, onClose, onSaved }: Props) => {
  const [form, setForm] = useState<FormState>(
    mode === "edit" && agent ? fromAgent(agent) : emptyForm(),
  );
  const [skillOptions, setSkillOptions] = useState<Skill[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(mode === "edit" && agent ? fromAgent(agent) : emptyForm());
    setError("");
  }, [mode, agent]);

  useEffect(() => {
    void invoke<Skill[]>("skill_list")
      .then(setSkillOptions)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleSkill = (name: string) => {
    setForm((prev) => {
      const has = prev.skills.includes(name);
      return {
        ...prev,
        skills: has
          ? prev.skills.filter((s) => s !== name)
          : [...prev.skills, name],
      };
    });
  };

  const save = async () => {
    setError("");
    setBusy(true);
    const payload = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      systemPrompt: form.systemPrompt,
      emoji: form.emoji.trim(),
      enabled: form.enabled,
      skills: toSkillsPayload(form),
      allowAsSubagent: form.allowAsSubagent,
    };
    try {
      if (mode === "edit" && agent) {
        await invoke("agent_update", { id: agent.id, ...payload });
      } else {
        await invoke("agent_add", payload);
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
        aria-labelledby="agent-modal-title"
      >
        <div className="model-modal__header">
          <h2 id="agent-modal-title" className="model-modal__title">
            {mode === "edit" ? "编辑代理" : "新建代理"}
          </h2>
          <button type="button" className="model-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="model-modal__body">
          <p className="skill-modal__hint">
            对齐 OpenClaw <code>agents.list</code>：人格、技能白名单、可否作为子代理
          </p>

          <div className="agent-form-grid">
            <div className="mcp-form-row">
              <label>名称</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="内容写手"
              />
            </div>
            <div className="mcp-form-row">
              <label>ID（slug）</label>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="writer"
              />
            </div>
          </div>

          <div className="agent-form-grid">
            <div className="mcp-form-row">
              <label>Emoji</label>
              <input
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                placeholder="✍️"
              />
            </div>
            <div className="mcp-form-row">
              <label>简介</label>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="一句话说明职责"
              />
            </div>
          </div>

          <div className="mcp-form-row">
            <label>人格 / 系统提示</label>
            <textarea
              className="skill-body"
              rows={6}
              value={form.systemPrompt}
              onChange={(e) =>
                setForm({ ...form, systemPrompt: e.target.value })
              }
              placeholder="你是……"
            />
          </div>

          <div className="mcp-form-row">
            <label>技能可见性</label>
            <div className="agent-skills-mode">
              {(
                [
                  ["all", "全部技能"],
                  ["allowlist", "白名单"],
                  ["none", "无技能"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="account-enabled">
                  <input
                    type="radio"
                    name="skills-mode"
                    checked={form.skillsMode === value}
                    onChange={() => setForm({ ...form, skillsMode: value })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {form.skillsMode === "allowlist" && (
            <div className="agent-skill-picks">
              {skillOptions.length === 0 ? (
                <p className="skill-modal__hint">暂无可用技能，请先到技能管理添加</p>
              ) : (
                skillOptions.map((s) => (
                  <label key={s.id} className="account-enabled">
                    <input
                      type="checkbox"
                      checked={form.skills.includes(s.name)}
                      onChange={() => toggleSkill(s.name)}
                    />
                    <span>
                      <code>{s.name}</code>
                      <span className="agent-skill-picks__desc">
                        {s.description}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          )}

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
                checked={form.allowAsSubagent}
                onChange={(e) =>
                  setForm({ ...form, allowAsSubagent: e.target.checked })
                }
              />
              <span>可作为子代理（spawn_agent）</span>
            </label>
          </div>

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
            disabled={!form.name.trim() || !form.slug.trim() || busy}
          >
            {busy ? "保存中…" : mode === "edit" ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
};
