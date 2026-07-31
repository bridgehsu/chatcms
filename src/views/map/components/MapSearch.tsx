import { useEffect, useRef, useState } from "react";
import type { MapLink, MapSection } from "../types";

type ResultItem = {
  link: MapLink;
  sectionTitle: string;
};

type Props = {
  favorites: MapLink[];
  sections: MapSection[];
};

const openLink = (url?: string) => {
  if (!url) return;
  if (url.startsWith("#")) {
    window.location.hash = url.slice(1);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};

export const MapSearch = ({ favorites, sections }: Props) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results: ResultItem[] = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const match = (link: MapLink) =>
      link.title.toLowerCase().includes(q) ||
      link.desc.toLowerCase().includes(q);

    const favMatches: ResultItem[] = favorites
      .filter(match)
      .map((link) => ({ link, sectionTitle: "常用工具" }));

    const sectionMatches: ResultItem[] = sections.flatMap((sec) =>
      sec.links.filter(match).map((link) => ({ link, sectionTitle: sec.title }))
    );

    return [...favMatches, ...sectionMatches].slice(0, 12);
  })();

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cmd/Ctrl+K 聚焦
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setQuery("");
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="map-search" ref={wrapRef}>
      <div className="map-search__input-wrap">
        <svg className="map-search__icon" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          className="map-search__input"
          placeholder="搜索入口… ⌘K"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {query && (
          <button
            type="button"
            className="map-search__clear"
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
          >
            ×
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="map-search__dropdown">
          {results.length === 0 ? (
            <div className="map-search__empty">没有找到相关入口</div>
          ) : (
            results.map((item) => (
              <div
                key={item.link.id}
                className="map-search__item"
                onClick={() => {
                  openLink(item.link.url);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="map-search__item-title">{item.link.title}</span>
                <span className="map-search__item-section">{item.sectionTitle}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
