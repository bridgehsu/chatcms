/** 代理表单中的技能白名单配置（null = 全部） */
export type SkillsConfig = {
  mode: "all" | "none" | "allowlist";
  skills: string[];
};

/** 后端 skills 字段 → 表单 SkillsConfig */
export const skillsToConfig = (skills: string[] | null): SkillsConfig => {
  if (skills === null) return { mode: "all", skills: [] };
  if (skills.length === 0) return { mode: "none", skills: [] };
  return { mode: "allowlist", skills: [...skills] };
};

/** 表单 SkillsConfig → 后端 skills 字段 */
export const configToSkills = (
  config: SkillsConfig | undefined,
): string[] | null => {
  if (!config || config.mode === "all") return null;
  if (config.mode === "none") return [];
  return config.skills ?? [];
};
