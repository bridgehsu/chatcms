import { useCallback, useEffect, useState } from "react";
import { createSeedState } from "../data/seed";
import type { BusinessMapState, MapLink, MapSection } from "../types";

const STORAGE_KEY = "chatcms.business-map.v1";

const load = (): BusinessMapState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as BusinessMapState;
    if (!parsed?.sections || !Array.isArray(parsed.sections)) return createSeedState();
    return {
      ...createSeedState(),
      ...parsed,
      favorites: parsed.favorites ?? [],
      sections: parsed.sections,
      note: parsed.note ?? "",
      metrics: parsed.metrics?.length ? parsed.metrics : createSeedState().metrics,
    };
  } catch {
    return createSeedState();
  }
};

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useBusinessMap = () => {
  const [state, setState] = useState<BusinessMapState>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const setNote = useCallback((note: string) => {
    setState((s) => ({ ...s, note }));
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setState((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, collapsed: !sec.collapsed } : sec,
      ),
    }));
  }, []);

  const toggleLock = useCallback((sectionId: string) => {
    setState((s) => ({
      ...s,
      sections: s.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, locked: !sec.locked } : sec,
      ),
    }));
  }, []);

  const addLink = useCallback((sectionId: string | "favorites", link: Omit<MapLink, "id">) => {
    const next: MapLink = { ...link, id: newId() };
    setState((s) => {
      if (sectionId === "favorites") {
        return { ...s, favorites: [...s.favorites, next] };
      }
      return {
        ...s,
        sections: s.sections.map((sec) =>
          sec.id === sectionId && !sec.locked
            ? { ...sec, links: [...sec.links, next] }
            : sec,
        ),
      };
    });
  }, []);

  const removeLink = useCallback((sectionId: string | "favorites", linkId: string) => {
    setState((s) => {
      if (sectionId === "favorites") {
        return { ...s, favorites: s.favorites.filter((l) => l.id !== linkId) };
      }
      return {
        ...s,
        sections: s.sections.map((sec) =>
          sec.id === sectionId && !sec.locked
            ? { ...sec, links: sec.links.filter((l) => l.id !== linkId) }
            : sec,
        ),
      };
    });
  }, []);

  const reset = useCallback(() => setState(createSeedState()), []);

  return {
    state,
    sections: state.sections as MapSection[],
    favorites: state.favorites,
    note: state.note,
    metrics: state.metrics,
    setNote,
    toggleSection,
    toggleLock,
    addLink,
    removeLink,
    reset,
  };
};
