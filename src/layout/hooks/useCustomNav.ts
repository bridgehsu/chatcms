import { useCallback, useEffect, useState } from "react";

export type CustomNavEntry = {
  id: string;
  label: string;
  path: string;
  sortOrder: number;
};

const STORAGE_KEY = "chatcms.custom.nav.v1";

const load = (): CustomNavEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as CustomNavEntry[]).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
  } catch {
    return [];
  }
};

const save = (entries: CustomNavEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
};

export const useCustomNav = () => {
  const [entries, setEntries] = useState<CustomNavEntry[]>(load);

  useEffect(() => {
    save(entries);
  }, [entries]);

  const add = useCallback((label: string, path: string, sortOrder: number) => {
    const entry: CustomNavEntry = {
      id: crypto.randomUUID(),
      label,
      path,
      sortOrder,
    };
    setEntries((prev) =>
      [...prev, entry].sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }, []);

  const update = useCallback(
    (id: string, label: string, path: string, sortOrder: number) => {
      setEntries((prev) =>
        prev
          .map((e) => (e.id === id ? { ...e, label, path, sortOrder } : e))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { entries, add, update, remove };
};
