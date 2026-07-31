import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { MapLink, MapSection } from "../types";

type Engine = {
  id: string;
  label: string;
  buildUrl: (q: string) => string;
};

const ENGINES: Engine[] = [
  { id: "local", label: "本站", buildUrl: () => "" },
  { id: "google", label: "Google", buildUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { id: "chatgpt", label: "ChatGPT", buildUrl: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { id: "deepseek", label: "DeepSeek", buildUrl: (q) => `https://chat.deepseek.com/?q=${encodeURIComponent(q)}` },
];

type ResultItem = {
  link: MapLink;
  sectionTitle: string;
};

type Props = {
  favorites: MapLink[];
  sections: MapSection[];
};

export const MapSearch = ({ favorites, sections }: Props) => {
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [engineId, setEngineId] = useState("local");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const engine = ENGINES.find((e) => e.id === engineId) ?? ENGINES[0];
  const isLocal = engine.id === "local";

  const results: ResultItem[] = (() => {
    if (!isLocal) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const match = (link: MapLink) =>
      link.title.toLowerCase().includes(q) || link.desc.toLowerCase().includes(q);
    return [
      ...favorites.filter(match).map((link) => ({ link, sectionTitle: "常用工具" })),
      ...sections.flatMap((sec) =>
        sec.links.filter(match).map((link) => ({ link, sectionTitle: sec.title }))
      ),
    ].slice(0, 12);
  })();

  const openLink = (url?: string) => {
    if (!url) return;
    if (url.startsWith("#")) {
      window.location.hash = url.slice(1);
      return;
    }
    openUrl(url);
  };

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    if (!isLocal) {
      openUrl(engine.buildUrl(q));
      setQuery("");
      setDropdownOpen(false);
    }
  };

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
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
        setDropdownOpen(true);
      }
      if (e.key === "Escape") {
        setQuery("");
        setDropdownOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="map-search" ref={wrapRef}>
      <div className="map-search__input-wrap">
        <select
          className="map-search__engine"
          value={engineId}
          onChange={(e) => setEngineId(e.target.value)}
          aria-label="搜索引擎"
        >
          {ENGINES.map((e) => (
            <option key={e.id} value={e.id}>{e.label}</option>
          ))}
        </select>
        <div className="map-search__divider" />
        <svg className="map-search__icon" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          className="map-search__input"
          placeholder={isLocal ? "搜索入口… ⌘K" : `用 ${engine.label} 搜索… ⌘K`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
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

      {dropdownOpen && isLocal && query.trim() && (
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
                  setDropdownOpen(false);
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
