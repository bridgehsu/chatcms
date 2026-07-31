import { useCallback, useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";

export type CustomNavEntry = {
  id: string;
  label: string;
  path: string;
  sortOrder: number;
};

export const useCustomNav = () => {
  const [entries, setEntries] = useState<CustomNavEntry[]>([]);

  const load = useCallback(async () => {
    const list = await invoke<any[]>("nav_custom_list");
    setEntries(
      list.map((b) => ({
        id: b.id,
        label: b.title,
        path: b.url,
        sortOrder: b.sort_order,
      })),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(
    async (label: string, path: string, sortOrder: number) => {
      await invoke("nav_custom_upsert", { id: null, label, path, sortOrder });
      await load();
    },
    [load],
  );

  const update = useCallback(
    async (id: string, label: string, path: string, sortOrder: number) => {
      await invoke("nav_custom_upsert", { id, label, path, sortOrder });
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await invoke("nav_custom_remove", { id });
      await load();
    },
    [load],
  );

  return { entries, add, update, remove };
};
