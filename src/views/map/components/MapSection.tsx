import { IconChevron, IconLock, IconPlus } from "@/components/icons";
import type { MapLink, MapSection as MapSectionData } from "../types";
import { MapLinkCard } from "./MapLinkCard";

type Props = {
  section: MapSectionData;
  onToggle: () => void;
  onToggleLock: () => void;
  onAdd: () => void;
  onRemoveLink: (linkId: string) => void;
};

export const MapSectionCard = ({
  section,
  onToggle,
  onToggleLock,
  onAdd,
  onRemoveLink,
}: Props) => (
  <section className={`map-section${section.collapsed ? " is-collapsed" : ""}`}>
    <header className="map-section__header">
      <div className="map-section__title-wrap">
        <h2 className="map-section__title">{section.title}</h2>
        <span className="map-section__count">{section.links.length}</span>
      </div>
      <div className="map-section__actions">
        <button
          type="button"
          className={`map-icon-btn${section.locked ? " is-on" : ""}`}
          aria-label={section.locked ? "解锁分区" : "锁定分区"}
          title={section.locked ? "已锁定" : "锁定"}
          onClick={onToggleLock}
        >
          <IconLock locked={section.locked} />
        </button>
        <button
          type="button"
          className="map-add-btn"
          aria-label="添加入口"
          disabled={section.locked}
          onClick={onAdd}
        >
          <IconPlus />
        </button>
        <button
          type="button"
          className="map-icon-btn"
          aria-label={section.collapsed ? "展开" : "收起"}
          aria-expanded={!section.collapsed}
          onClick={onToggle}
        >
          <IconChevron open={!section.collapsed} />
        </button>
      </div>
    </header>

    {!section.collapsed && (
      <div className="map-section__body">
        {section.links.length === 0 ? (
          <p className="map-empty">当前没有可展示的入口，点击右上角 + 添加</p>
        ) : (
          <div className="map-link-grid">
            {section.links.map((link: MapLink) => (
              <MapLinkCard
                key={link.id}
                link={link}
                removable={!section.locked}
                onRemove={() => onRemoveLink(link.id)}
              />
            ))}
          </div>
        )}
      </div>
    )}
  </section>
);
