import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconPencil, IconTrash } from "@/components/icons";
import type { MapLink } from "../types";

const toneClass = (tone?: MapLink["tone"]) =>
  `map-mark map-mark--${tone ?? "slate"}`;

const getFaviconUrl = (url?: string): string | null => {
  if (!url || url.startsWith("#")) return null;
  try {
    const origin = new URL(url).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
};

const LinkIcon = ({ link }: { link: MapLink }) => {
  const faviconUrl = getFaviconUrl(link.url);
  const [faviconFailed, setFaviconFailed] = useState(false);

  if (faviconUrl && !faviconFailed) {
    return (
      <img
        src={faviconUrl}
        alt=""
        className="map-link-card__favicon"
        width={28}
        height={28}
        onError={() => setFaviconFailed(true)}
      />
    );
  }

  return (
    <span className={toneClass(link.tone)} aria-hidden="true">
      {link.mark.slice(0, 2)}
    </span>
  );
};

type Props = {
  link: MapLink;
  unlocked?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
};

export const MapLinkCard = ({ link, unlocked, onEdit, onRemove }: Props) => {
  const open = () => {
    if (!link.url) return;
    if (link.url.startsWith("#")) {
      window.location.hash = link.url.slice(1);
      return;
    }
    openUrl(link.url);
  };

  return (
    <div
      className={`map-link-card${link.url ? " is-clickable" : ""}${unlocked ? " is-unlocked" : ""}`}
      onClick={link.url && !unlocked ? open : undefined}
      role={link.url && !unlocked ? "link" : undefined}
      tabIndex={link.url && !unlocked ? 0 : undefined}
      onKeyDown={(e) => {
        if (!link.url || unlocked) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <LinkIcon link={link} />
      <div className="map-link-card__body">
        <div className="map-link-card__title">{link.title}</div>
        <div className="map-link-card__desc">{link.desc}</div>
      </div>
      {unlocked && (
        <div className="map-link-card__actions">
          {onEdit && (
            <button
              type="button"
              className="map-link-card__action-btn"
              aria-label={`编辑 ${link.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <IconPencil />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="map-link-card__action-btn map-link-card__action-btn--danger"
              aria-label={`删除 ${link.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <IconTrash />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
