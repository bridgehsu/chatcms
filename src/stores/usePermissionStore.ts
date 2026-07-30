import { create } from "zustand";
import { invoke } from "@/hooks/useTauri";
import type { PermissionMode } from "@/types";

type PermissionState = {
  modes: PermissionMode[];
  activeModeId: string;
  loaded: boolean;
  load: () => Promise<void>;
  setActive: (id: string) => Promise<void>;
};

/** 权限模式列表 + 当前激活（会话工具栏与管理页共享） */
export const usePermissionStore = create<PermissionState>((set, get) => ({
  modes: [],
  activeModeId: "",
  loaded: false,

  load: async () => {
    const cfg = await invoke<{
      modes: PermissionMode[];
      active_mode_id: string;
    }>("plugin:permission|permission_get");
    const modes = [...(cfg.modes ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
    let activeModeId = cfg.active_mode_id || "";
    if (!activeModeId || !modes.some((m) => m.id === activeModeId)) {
      activeModeId = modes[0]?.id ?? "";
      if (activeModeId) {
        await invoke("plugin:permission|permission_mode_set_active", { id: activeModeId }).catch(
          () => undefined,
        );
      }
    }
    set({ modes, activeModeId, loaded: true });
  },

  setActive: async (id: string) => {
    if (!id || id === get().activeModeId) return;
    await invoke("plugin:permission|permission_mode_set_active", { id });
    set({ activeModeId: id });
  },
}));
