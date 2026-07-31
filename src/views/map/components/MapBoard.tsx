import { IconPlus } from "@/components/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildDeadlines } from "../data/seed";
import { useBusinessMap } from "../hooks/useBusinessMap";
import type { MapLink } from "../types";
import { MapDeadlineBar } from "./MapDeadlineBar";
import { MapLinkCard } from "./MapLinkCard";
import { MapLinkModal } from "./MapLinkModal";
import { MapMetricRow } from "./MapMetricRow";
import { MapQuickNote } from "./MapQuickNote";
import { MapSectionCard } from "./MapSection";
import { MapSectionModal } from "./MapSectionModal";
import { MapWorldClock } from "./MapWorldClock";

export const MapBoard = () => {
  const {
    favorites,
    sections,
    note,
    metrics,
    setNote,
    toggleSection,
    toggleLock,
    addSection,
    removeSection,
    addLink,
    removeLink,
  } = useBusinessMap();

  const [modalTarget, setModalTarget] = useState<string | "favorites" | null>(null);
  const [sectionModal, setSectionModal] = useState(false);
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
                  onClick={() => setModalTarget("favorites")}
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
                      removable
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

      <MapMetricRow metrics={metrics} />

      {sections.map((section) => (
        <MapSectionCard
          key={section.id}
          section={section}
          onToggle={() => toggleSection(section.id)}
          onToggleLock={() => toggleLock(section.id)}
          onAdd={() => setModalTarget(section.id)}
          onRemoveLink={(linkId) => removeLink(section.id, linkId)}
          onRemove={() => removeSection(section.id)}
        />
      ))}

      <MapLinkModal
        open={modalTarget !== null}
        title={modalTarget === "favorites" ? "添加常用工具" : "添加入口"}
        onClose={() => setModalTarget(null)}
        onSubmit={(link: Omit<MapLink, "id">) => {
          if (modalTarget) addLink(modalTarget, link);
        }}
      />

      <MapSectionModal
        open={sectionModal}
        onClose={() => setSectionModal(false)}
        onSubmit={(title, icon) => addSection(title, icon)}
      />
    </div>
  );
};
