import type { ProviderKind } from "@/types";

export type ModelVersion = {
  id: string;
  label: string;
  model: string;
};

export type ModelFamily = {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  versions: ModelVersion[];
};

/** 模型族 + 版本（聊天区级联选择） */
export const MODEL_FAMILIES: ModelFamily[] = [
  {
    id: "claude",
    label: "Claude",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    versions: [
      { id: "claude-sonnet-4-6", label: "Sonnet 4.6", model: "claude-sonnet-4-6" },
      { id: "claude-opus-4", label: "Opus 4", model: "claude-opus-4-20250514" },
      { id: "claude-haiku-3-5", label: "Haiku 3.5", model: "claude-3-5-haiku-latest" },
    ],
  },
  {
    id: "openai",
    label: "GPT",
    kind: "openai",
    baseUrl: "https://api.openai.com",
    versions: [
      { id: "gpt-4o", label: "GPT-4o", model: "gpt-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini", model: "gpt-4o-mini" },
      { id: "gpt-4-1", label: "GPT-4.1", model: "gpt-4.1" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai",
    baseUrl: "https://api.deepseek.com",
    versions: [
      { id: "deepseek-chat", label: "V3 Chat", model: "deepseek-chat" },
      { id: "deepseek-reasoner", label: "R1 Reasoner", model: "deepseek-reasoner" },
    ],
  },
  {
    id: "kimi",
    label: "Kimi",
    kind: "openai",
    baseUrl: "https://api.moonshot.cn",
    versions: [
      { id: "moonshot-v1-8k", label: "moonshot-v1-8k", model: "moonshot-v1-8k" },
      { id: "moonshot-v1-32k", label: "moonshot-v1-32k", model: "moonshot-v1-32k" },
      { id: "moonshot-v1-128k", label: "moonshot-v1-128k", model: "moonshot-v1-128k" },
    ],
  },
  {
    id: "qwen",
    label: "通义千问",
    kind: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
    versions: [
      { id: "qwen-plus", label: "Qwen Plus", model: "qwen-plus" },
      { id: "qwen-turbo", label: "Qwen Turbo", model: "qwen-turbo" },
      { id: "qwen-max", label: "Qwen Max", model: "qwen-max" },
    ],
  },
];

export type FamilyId = (typeof MODEL_FAMILIES)[number]["id"];

/** @deprecated 兼容旧命名 */
export type PresetId = FamilyId;

export const FAMILY_OPTIONS = MODEL_FAMILIES.map((f) => ({
  value: f.id,
  label: f.label,
}));

/** @deprecated 兼容旧命名 */
export const PRESET_OPTIONS = FAMILY_OPTIONS;

export const getFamily = (id: string): ModelFamily =>
  MODEL_FAMILIES.find((f) => f.id === id) ?? MODEL_FAMILIES[0];

export const getVersionOptions = (familyId: string) =>
  getFamily(familyId).versions.map((v) => ({
    value: v.id,
    label: v.label,
  }));

export const getVersion = (familyId: string, versionId: string): ModelVersion => {
  const family = getFamily(familyId);
  return family.versions.find((v) => v.id === versionId) ?? family.versions[0];
};

export const matchFamilyVersion = (
  kind: ProviderKind,
  model: string,
  baseUrl: string,
): { familyId: FamilyId; versionId: string } => {
  const normalized = baseUrl.replace(/\/$/, "");

  for (const family of MODEL_FAMILIES) {
    if (family.kind !== kind) continue;
    if (family.baseUrl.replace(/\/$/, "") !== normalized && normalized) {
      // 仍允许按 model 名匹配
    }
    const version = family.versions.find((v) => v.model === model || v.id === model);
    if (version) {
      return { familyId: family.id as FamilyId, versionId: version.id };
    }
  }

  for (const family of MODEL_FAMILIES) {
    const version = family.versions.find((v) => v.model === model || v.id === model);
    if (version) {
      return { familyId: family.id as FamilyId, versionId: version.id };
    }
  }

  const fallback = MODEL_FAMILIES[0];
  return { familyId: fallback.id as FamilyId, versionId: fallback.versions[0].id };
};

/** @deprecated */
export const matchPreset = (
  kind: ProviderKind,
  model: string,
  baseUrl: string,
): FamilyId => matchFamilyVersion(kind, model, baseUrl).familyId;

/** @deprecated：取族默认版本对应的「扁平预设」 */
export const getPreset = (id: FamilyId) => {
  const family = getFamily(id);
  const version = family.versions[0];
  return {
    id: family.id,
    label: family.label,
    kind: family.kind,
    model: version.model,
    baseUrl: family.baseUrl,
  };
};

/** 旧扁平列表（设置弹窗若仍用单选可过渡） */
export const MODEL_PRESETS = MODEL_FAMILIES.flatMap((f) =>
  f.versions.map((v) => ({
    id: v.id,
    label: `${f.label} · ${v.label}`,
    kind: f.kind,
    model: v.model,
    baseUrl: f.baseUrl,
    familyId: f.id,
  })),
);
