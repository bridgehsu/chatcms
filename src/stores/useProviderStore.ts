import { create } from "zustand";
import {
  getFamily,
  getVersion,
  matchFamilyVersion,
  type FamilyId,
} from "@/config/modelPresets";
import { invoke } from "@/hooks/useTauri";
import type { AppConfig, ProviderKind } from "@/types";

type ProviderState = {
  loaded: boolean;
  apiKey: string;
  model: string;
  provider: ProviderKind;
  baseUrl: string;
  familyId: FamilyId;
  versionId: string;
  /** @deprecated 同 familyId */
  presetId: FamilyId;
  load: () => Promise<void>;
  selectFamily: (familyId: FamilyId) => Promise<void>;
  selectVersion: (versionId: string) => Promise<void>;
  /** @deprecated 选族并落到默认版本 */
  selectPreset: (id: FamilyId) => Promise<void>;
  saveFull: (next: {
    apiKey: string;
    model: string;
    provider: ProviderKind;
    baseUrl: string;
  }) => Promise<void>;
};

const applyVersion = async (
  familyId: FamilyId,
  versionId: string,
  apiKey: string,
) => {
  const family = getFamily(familyId);
  const version = getVersion(familyId, versionId);
  await invoke("config_set", {
    apiKey,
    model: version.model,
    provider: family.kind,
    baseUrl: family.baseUrl,
  });
  return {
    familyId,
    versionId: version.id,
    presetId: familyId,
    model: version.model,
    provider: family.kind,
    baseUrl: family.baseUrl,
  } as const;
};

export const useProviderStore = create<ProviderState>((set, get) => ({
  loaded: false,
  apiKey: "",
  model: "claude-sonnet-4-6",
  provider: "anthropic",
  baseUrl: "",
  familyId: "claude",
  versionId: "claude-sonnet-4-6",
  presetId: "claude",

  load: async () => {
    const cfg = await invoke<AppConfig>("config_get");
    const matched = matchFamilyVersion(
      cfg.provider.kind,
      cfg.provider.model,
      cfg.provider.base_url ?? "",
    );
    set({
      loaded: true,
      apiKey: cfg.provider.api_key,
      model: cfg.provider.model,
      provider: cfg.provider.kind,
      baseUrl: cfg.provider.base_url ?? "",
      familyId: matched.familyId,
      versionId: matched.versionId,
      presetId: matched.familyId,
    });
  },

  selectFamily: async (familyId) => {
    const family = getFamily(familyId);
    const versionId = family.versions[0].id;
    const next = await applyVersion(familyId, versionId, get().apiKey);
    set(next);
  },

  selectVersion: async (versionId) => {
    const { familyId, apiKey } = get();
    const next = await applyVersion(familyId, versionId, apiKey);
    set(next);
  },

  selectPreset: async (id) => {
    await get().selectFamily(id);
  },

  saveFull: async ({ apiKey, model, provider, baseUrl }) => {
    await invoke("config_set", {
      apiKey,
      model,
      provider,
      baseUrl: baseUrl || null,
    });
    const matched = matchFamilyVersion(provider, model, baseUrl);
    set({
      apiKey,
      model,
      provider,
      baseUrl,
      familyId: matched.familyId,
      versionId: matched.versionId,
      presetId: matched.familyId,
    });
  },
}));
