import { Badge, Button, Checkbox, Radio, Space } from "antd";
import type { Skill } from "@/types";
import type { SkillsConfig } from "@/utils/agentSkills";

export type { SkillsConfig };

const SkillsField = ({
  value = { mode: "all", skills: [] },
  onChange,
  skillOptions,
}: {
  value?: SkillsConfig;
  onChange?: (v: SkillsConfig) => void;
  skillOptions: Skill[];
}) => {
  const set = (patch: Partial<SkillsConfig>) =>
    onChange?.({ ...value, ...patch });

  const allNames = skillOptions.map((s) => s.name);
  const selectedCount = value.skills.length;
  const isAllSelected =
    allNames.length > 0 && selectedCount === allNames.length;

  return (
    <div className="agent-skills">
      <Radio.Group
        className="agent-skills__modes"
        value={value.mode}
        onChange={(e) => set({ mode: e.target.value, skills: value.skills })}
        optionType="button"
        buttonStyle="solid"
        size="middle"
      >
        <Radio.Button value="all">全部技能</Radio.Button>
        <Radio.Button value="allowlist">
          指定白名单
          {value.mode === "allowlist" && selectedCount > 0 ? (
            <Badge
              count={selectedCount}
              size="small"
              className="agent-skills__badge"
            />
          ) : null}
        </Radio.Button>
        <Radio.Button value="none">不使用</Radio.Button>
      </Radio.Group>

      {value.mode === "allowlist" ? (
        <div className="agent-skills__panel">
          {skillOptions.length > 0 ? (
            <div className="agent-skills__toolbar">
              <span className="agent-skills__count">
                {selectedCount > 0
                  ? `已选 ${selectedCount} / ${allNames.length}`
                  : "从下方勾选可用技能"}
              </span>
              <Space size={8}>
                <Button
                  type="link"
                  size="small"
                  className="agent-skills__link"
                  onClick={() => set({ skills: allNames })}
                  disabled={isAllSelected}
                >
                  全选
                </Button>
                <Button
                  type="link"
                  size="small"
                  className="agent-skills__link"
                  onClick={() => set({ skills: [] })}
                  disabled={selectedCount === 0}
                >
                  清空
                </Button>
              </Space>
            </div>
          ) : null}

          <div className="agent-skills__list">
            {skillOptions.length === 0 ? (
              <p className="agent-skills__empty">
                暂无可用技能，请先到「技能管理」添加
              </p>
            ) : (
              <Checkbox.Group
                value={value.skills}
                onChange={(checked) => set({ skills: checked as string[] })}
                className="agent-skills__checks"
              >
                {skillOptions.map((s) => (
                  <Checkbox
                    key={s.name}
                    value={s.name}
                    className={`agent-skills__item${
                      value.skills.includes(s.name) ? " is-on" : ""
                    }`}
                  >
                    <span className="agent-skills__item-body">
                      <span className="agent-skills__item-name">{s.name}</span>
                      {s.description ? (
                        <span className="agent-skills__item-desc">
                          {s.description}
                        </span>
                      ) : null}
                    </span>
                  </Checkbox>
                ))}
              </Checkbox.Group>
            )}
          </div>
        </div>
      ) : value.mode === "all" ? (
        <p className="agent-skills__hint">
          该代理可调用技能库中的全部技能（随技能增删自动同步）。
        </p>
      ) : (
        <p className="agent-skills__hint">
          该代理不会挂载任何技能，仅依赖系统提示与内置工具。
        </p>
      )}
    </div>
  );
};

export default SkillsField;
