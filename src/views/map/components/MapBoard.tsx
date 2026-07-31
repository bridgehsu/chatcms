import { IconPlus } from "@/components/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildDeadlines } from "../data/seed";
import { useBusinessMap } from "../hooks/useBusinessMap";
import type { MapLink } from "../types";
import { MapDeadlineBar } from "./MapDeadlineBar";
import { MapLinkCard } from "./MapLinkCard";
import { MapLinkModal } from "./MapLinkModal";
import { MapQuickNote } from "./MapQuickNote";
import { MapSectionCard } from "./MapSection";
import { MapSectionModal } from "./MapSectionModal";
import { MapWorldClock } from "./MapWorldClock";

type LinkTarget = { sectionId: string | "favorites"; link: MapLink } | null;

export const MapBoard = () => {
  const {
    favorites,
    sections,
    note,
    setNote,
    toggleSection,
    toggleLock,
    addSection,
    updateSection,
    removeSection,
    addLink,
    updateLink,
    removeLink,
  } = useBusinessMap();

  const [addTarget, setAddTarget] = useState<string | "favorites" | null>(null);
  const [editingLink, setEditingLink] = useState<LinkTarget>(null);
  const [sectionModal, setSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<typeof sections[number] | null>(null);
  const deadlines = useMemo(() => buildDeadlines(), []);
  const sideRef = useRef<HTMLElement>(null);
  const favoritesRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handler = () => setSectionModal(true);
    window.addEventListener("map:open-add-section", handler);
    return () => window.removeEventListener("map:open-add-section", handler);
  }, []);

  /** 常用工具最小高度 = 快速记录 + 世界时钟 + 中间间距 */
  useEffect(() => {
    const side = sideRef.current;
    const fav = favoritesRef.current;
    if (!side || !fav) return;

    const sync = () => {
      if (window.matchMedia("(max-width: 960px)").matches) {
        fav.style.minHeight = "";
        fav.style.height = "";
        fav.style.maxHeight = "";
        return;
      }

      const note = side.querySelector<HTMLElement>(".map-note");
      const clock = side.querySelector<HTMLElement>(".map-clock");
      if (!note || !clock) return;

      const styles = getComputedStyle(side);
      const gap = parseFloat(styles.rowGap || styles.gap || "0") || 16;
      const minHeight = Math.round(
        note.getBoundingClientRect().height +
          clock.getBoundingClientRect().height +
          gap,
      );

      fav.style.height = "";
      fav.style.maxHeight = "";
      fav.style.minHeight = `${minHeight}px`;
    };

    const schedule = () => requestAnimationFrame(sync);
    const ro = new ResizeObserver(schedule);
    ro.observe(side);
    const note = side.querySelector(".map-note");
    const clock = side.querySelector(".map-clock");
    if (note) ro.observe(note);
    if (clock) ro.observe(clock);

    schedule();
    window.addEventListener("resize", schedule);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      fav.style.minHeight = "";
      fav.style.height = "";
      fav.style.maxHeight = "";
    };
  }, [favorites.length, note]);

  return (
    <div className="map-board">
      <div className="map-board__upper">
        <MapDeadlineBar items={deadlines} />

        <div className="map-top">
          <section className="map-card map-favorites" ref={favoritesRef}>
            <header className="map-section__header">
              <div className="map-section__title-wrap">
                <h2 className="map-section__title">常用工具</h2>
                <span className="map-section__count">{favorites.length}</span>
              </div>
              <div className="map-section__actions">
                <button
                  type="button"
                  className="map-add-btn"
                  aria-label="添加常用工具"
                  onClick={() => setAddTarget("favorites")}
                >
                  <IconPlus />
                </button>
              </div>
            </header>
            <div className="map-section__body">
              {favorites.length === 0 ? (
                <p className="map-empty">当前没有可展示的常用工具</p>
              ) : (
                <div className="map-link-grid">
                  {favorites.map((link) => (
                    <MapLinkCard
                      key={link.id}
                      link={link}
                      onRemove={() => removeLink("favorites", link.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="map-side" ref={sideRef}>
            <MapQuickNote value={note} onChange={setNote} />
            <MapWorldClock />
          </aside>
        </div>
      </div>

      {sections.map((section) => (
        <MapSectionCard
          key={section.id}
          section={section}
          onToggle={() => toggleSection(section.id)}
          onToggleLock={() => toggleLock(section.id)}
          onAdd={() => setAddTarget(section.id)}
          onEdit={() => setEditingSection(section)}
          onRemove={() => removeSection(section.id)}
          onEditLink={(link) => setEditingLink({ sectionId: section.id, link })}
          onRemoveLink={(linkId) => removeLink(section.id, linkId)}
        />
      ))}

      {/* 添加导航元素弹窗 */}
      <MapLinkModal
        open={addTarget !== null}
        title={addTarget === "favorites" ? "添加常用工具" : "添加入口"}
        onClose={() => setAddTarget(null)}
        onSubmit={(link: Omit<MapLink, "id">) => {
          if (addTarget) addLink(addTarget, link);
        }}
      />

      {/* 编辑导航元素弹窗 */}
      <MapLinkModal
        open={editingLink !== null}
        title="编辑入口"
        initial={editingLink?.link}
        onClose={() => setEditingLink(null)}
        onSubmit={(data: Omit<MapLink, "id">) => {
          if (editingLink) updateLink(editingLink.sectionId, editingLink.link.id, data);
        }}
      />

      {/* 新增分类弹窗 */}
      <MapSectionModal
        open={sectionModal}
        onClose={() => setSectionModal(false)}
        onSubmit={(title, sortOrder) => addSection(title, sortOrder)}
      />

      {/* 编辑分类弹窗 */}
      <MapSectionModal
        open={editingSection !== null}
        initial={editingSection ?? undefined}
        onClose={() => setEditingSection(null)}
        onSubmit={(title, sortOrder) => {
          if (editingSection) updateSection(editingSection.id, title, sortOrder);
        }}
      />
    </div>
  );
};
