import { useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import type { AgentProfile, DomainPolicy, Skill } from "@/types";

type SkillsMode = "all" | "none" | "allowlist";

const OVERRIDE_DOMAINS: { id: string; label: string }[] = [
  { id: "file_read", label: "文件读取" },
  { id: "file_write", label: "文件写入" },
  { id: "shell", label: "终端" },
  { id: "mcp", label: "MCP" },
  { id: "agent", label: "子代理" },
  { id: "network", label: "网络" },
  { id: "browser", label: "浏览器" },
  { id: "app", label: "应用" },
];

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
  permissionOverrides: Record<string, DomainPolicy>;
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
  permissionOverrides: {},
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
    permissionOverrides: { ...(a.permission_overrides ?? {}) },
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
      permissionOverrides: form.permissionOverrides,
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
        className="agent-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-modal-title"
      >
        {/* Header */}
        <div className="agent-modal__header">
          <h2 id="agent-modal-title" className="agent-modal__title">
            {mode === "edit" ? "编辑代理" : "新建代理"}
          </h2>
          <button type="button" className="agent-modal__close" onClick={onClose} aria-label="关闭">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="agent-modal__body">

          {/* Section: 基本信息 */}
          <div className="agent-modal__section">
            <p className="agent-modal__section-title">基本信息</p>
            <div className="agent-modal__row2">
              <div className="agent-modal__field">
                <label className="agent-modal__label">代理名称</label>
                <input
                  className="agent-modal__input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="内容写手"
                />
              </div>
              <div className="agent-modal__field">
                <label className="agent-modal__label">ID（slug）</label>
                <input
                  className="agent-modal__input agent-modal__input--mono"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="writer"
                />
              </div>
            </div>
            <div className="agent-modal__row2">
              <div className="agent-modal__field">
                <label className="agent-modal__label">Emoji</label>
                <input
                  className="agent-modal__input agent-modal__input--emoji"
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  placeholder="✍️"
                />
              </div>
              <div className="agent-modal__field">
                <label className="agent-modal__label">简介</label>
                <input
                  className="agent-modal__input"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="一句话说明职责"
                />
              </div>
            </div>
          </div>

          {/* Section: 人格 */}
          <div className="agent-modal__section">
            <p className="agent-modal__section-title">系统提示</p>
            <textarea
              className="agent-modal__textarea"
              rows={6}
              value={form.systemPrompt}
              onChange={(e) =>
                setForm({ ...form, systemPrompt: e.target.value })
              }
              placeholder="你是一位专业的……，你的职责是……"
            />
          </div>

          {/* Section: 技能 */}
          <div className="agent-modal__section">
            <p className="agent-modal__section-title">技能配置</p>
            <div className="agent-modal__radios">
              {(
                [
                  ["all", "全部技能"],
                  ["allowlist", "指定白名单"],
                  ["none", "不使用技能"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="agent-modal__radio-label">
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

            {form.skillsMode === "allowlist" && (
              <div className="agent-modal__skill-picks">
                {skillOptions.length === 0 ? (
                  <p className="agent-modal__empty-hint">暂无可用技能，请先到技能管理添加</p>
                ) : (
                  skillOptions.map((s) => (
                    <label key={s.id} className="agent-modal__check-label">
                      <input
                        type="checkbox"
                        checked={form.skills.includes(s.name)}
                        onChange={() => toggleSkill(s.name)}
                      />
                      <span className="agent-modal__skill-name">
                        <code>{s.name}</code>
                        <span className="agent-modal__skill-desc">{s.description}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Section: 行为 */}
          <div className="agent-modal__section">
            <p className="agent-modal__section-title">行为设置</p>
            <div className="agent-modal__toggles">
              <label className="agent-modal__check-label">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm({ ...form, enabled: e.target.checked })
                  }
                />
                <span>启用此代理</span>
              </label>
              <label className="agent-modal__check-label">
                <input
                  type="checkbox"
                  checked={form.allowAsSubagent}
                  onChange={(e) =>
                    setForm({ ...form, allowAsSubagent: e.target.checked })
                  }
                />
                <span>允许作为子代理调用（spawn_agent）</span>
              </label>
            </div>
          </div>

          {/* Section: 权限覆盖 */}
          <div className="agent-modal__section">
            <p className="agent-modal__section-title">
              权限覆盖
              <span className="agent-modal__section-hint">未设置则继承全局域策略</span>
            </p>
            <div className="agent-modal__perm-grid">
              {OVERRIDE_DOMAINS.map((d) => (
                <div key={d.id} className="agent-modal__perm-row">
                  <span className="agent-modal__perm-label">{d.label}</span>
                  <select
                    className="agent-modal__perm-select"
                    value={form.permissionOverrides[d.id] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value as DomainPolicy | "";
                      setForm((prev) => {
                        const next = { ...prev.permissionOverrides };
                        if (!v) delete next[d.id];
                        else next[d.id] = v;
                        return { ...prev, permissionOverrides: next };
                      });
                    }}
                  >
                    <option value="">继承</option>
                    <option value="allow">允许</option>
                    <option value="ask">询问</option>
                    <option value="deny">拒绝</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {error && <div className="mcp-form-error">{error}</div>}
        </div>

        {/* Footer */}
        <div className="agent-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={!form.name.trim() || !form.slug.trim() || busy}
          >
            {busy ? "保存中…" : mode === "edit" ? "保存更改" : "创建代理"}
          </button>
        </div>
      </div>
    </div>
  );
};
