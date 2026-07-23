import type { MapLink } from "../types";

const toneClass = (tone?: MapLink["tone"]) =>
  `map-mark map-mark--${tone ?? "slate"}`;

type Props = {
  link: MapLink;
  onRemove?: () => void;
  removable?: boolean;
};

export const MapLinkCard = ({ link, onRemove, removable }: Props) => {
  const open = () => {
    if (!link.url) return;
    if (link.url.startsWith("#")) {
      window.location.hash = link.url.slice(1);
      return;
    }
    window.open(link.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={`map-link-card${link.url ? " is-clickable" : ""}`}
      onClick={link.url ? open : undefined}
      role={link.url ? "link" : undefined}
      tabIndex={link.url ? 0 : undefined}
      onKeyDown={(e) => {
        if (!link.url) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <span className={toneClass(link.tone)} aria-hidden="true">
        {link.mark.slice(0, 2)}
      </span>
      <div className="map-link-card__body">
        <div className="map-link-card__title">{link.title}</div>
        <div className="map-link-card__desc">{link.desc}</div>
      </div>
      {removable && onRemove && (
        <button
          type="button"
          className="map-link-card__remove"
          aria-label={`移除 ${link.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};
