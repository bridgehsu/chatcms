import { IconChevron, IconLock, IconPencil, IconPlus, IconTrash } from "@/components/icons";
import type { MapLink, MapSection as MapSectionData } from "../types";
import { MapLinkCard } from "./MapLinkCard";

type Props = {
  section: MapSectionData;
  onToggle: () => void;
  onToggleLock: () => void;
  onAdd: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onEditLink: (link: MapLink) => void;
  onRemoveLink: (linkId: string) => void;
};

export const MapSectionCard = ({
  section,
  onToggle,
  onToggleLock,
  onAdd,
  onEdit,
  onRemove,
  onEditLink,
  onRemoveLink,
}: Props) => {
  const unlocked = !section.locked;

  return (
    <section className={`map-section${section.collapsed ? " is-collapsed" : ""}`}>
      <header className="map-section__header">
        <div className="map-section__title-wrap">
          <h2 className="map-section__title">{section.title}</h2>
          <span className="map-section__count">{section.links.length}</span>
        </div>
        <div className="map-section__actions">
          {unlocked && (
            <>
              <button
                type="button"
                className="map-icon-btn"
                aria-label="编辑分类"
                title="编辑"
                onClick={onEdit}
              >
                <IconPencil />
              </button>
              <button
                type="button"
                className="map-icon-btn map-icon-btn--danger"
                aria-label="删除分类"
                title="删除"
                onClick={onRemove}
              >
                <IconTrash />
              </button>
            </>
          )}
          <button
            type="button"
            className={`map-icon-btn${unlocked ? " is-on" : ""}`}
            aria-label={unlocked ? "锁定分区" : "解锁分区"}
            title={unlocked ? "锁定" : "解锁"}
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
                  unlocked={unlocked}
                  onEdit={() => onEditLink(link)}
                  onRemove={() => onRemoveLink(link.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
