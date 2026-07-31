import { useCallback, useEffect, useState } from "react";
import { invoke } from "@/hooks/useTauri";
import { createSeedState } from "../data/seed";
import type { BusinessMapState, MapLink, MapSection } from "../types";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useBusinessMap = () => {
  const [state, setState] = useState<BusinessMapState>(() => createSeedState());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    invoke<BusinessMapState>("map_state_get").then((data) => {
      if (data && data.sections?.length) {
        setState(data);
      } else if (data) {
        setState({ ...createSeedState(), ...data });
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    invoke("map_state_save", { state }).catch(() => undefined);
  }, [state, loaded]);

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

  const addSection = useCallback((title: string, sortOrder: number) => {
    const section: MapSection = {
      id: newId(),
      title,
      icon: "",
      sort_order: sortOrder,
      locked: false,
      collapsed: false,
      links: [],
    };
    setState((s) => ({
      ...s,
      sections: [...s.sections, section].sort(
        (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999),
      ),
    }));
  }, []);

  const updateSection = useCallback((sectionId: string, title: string, sortOrder: number) => {
    setState((s) => ({
      ...s,
      sections: s.sections
        .map((sec) =>
          sec.id === sectionId
            ? { ...sec, title, sort_order: sortOrder }
            : sec,
        )
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)),
    }));
  }, []);

  const removeSection = useCallback((sectionId: string) => {
    setState((s) => ({
      ...s,
      sections: s.sections.filter((sec) => sec.id !== sectionId),
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

  const updateLink = useCallback((sectionId: string | "favorites", linkId: string, data: Omit<MapLink, "id">) => {
    setState((s) => {
      if (sectionId === "favorites") {
        return {
          ...s,
          favorites: s.favorites.map((l) => l.id === linkId ? { ...data, id: linkId } : l),
        };
      }
      return {
        ...s,
        sections: s.sections.map((sec) =>
          sec.id === sectionId && !sec.locked
            ? { ...sec, links: sec.links.map((l) => l.id === linkId ? { ...data, id: linkId } : l) }
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
    addSection,
    updateSection,
    removeSection,
    addLink,
    updateLink,
    removeLink,
    reset,
  };
};
