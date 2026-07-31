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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [engineId, setEngineId] = useState("local");
  const inputRef = useRef<HTMLInputElement>(null);

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
    ].slice(0, 10);
  })();

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const openLink = (url?: string) => {
    if (!url) return;
    openUrl(url);
    close();
  };

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    if (!isLocal) {
      openUrl(engine.buildUrl(q));
      close();
    }
  };

  // 自动聚焦
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // ⌘K 全局唤起
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* 触发按钮 */}
      <button
        type="button"
        className="map-search-trigger"
        onClick={() => setOpen(true)}
        aria-label="搜索"
      >
        <svg viewBox="0 0 16 16" fill="none" className="map-search-trigger__icon">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>搜索</span>
        <kbd>⌘K</kbd>
      </button>

      {/* 搜索浮层 */}
      {open && (
        <div className="map-search-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="map-search-modal__panel">
            {/* 引擎 Tab */}
            <div className="map-search-modal__engines">
              {ENGINES.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`map-search-modal__engine-tab${e.id === engineId ? " is-active" : ""}`}
                  onClick={() => { setEngineId(e.id); inputRef.current?.focus(); }}
                >
                  {e.label}
                </button>
              ))}
            </div>

            {/* 搜索输入框 */}
            <div className="map-search-modal__input-wrap">
              <svg className="map-search-modal__icon" viewBox="0 0 20 20" fill="none">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M13 13L17.5 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                className="map-search-modal__input"
                placeholder={isLocal ? "搜索入口、工具…" : `用 ${engine.label} 搜索…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              />
              {query && (
                <button
                  type="button"
                  className="map-search-modal__clear"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                >
                  ×
                </button>
              )}
            </div>

            {/* 本站搜索结果 */}
            {isLocal && query.trim() && (
              <div className="map-search-modal__results">
                {results.length === 0 ? (
                  <div className="map-search-modal__empty">没有找到相关入口</div>
                ) : (
                  results.map((item) => (
                    <div
                      key={item.link.id}
                      className="map-search-modal__item"
                      onClick={() => openLink(item.link.url)}
                    >
                      <span className="map-search-modal__item-title">{item.link.title}</span>
                      <span className="map-search-modal__item-section">{item.sectionTitle}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 外部引擎提示 */}
            {!isLocal && query.trim() && (
              <div className="map-search-modal__hint">
                按 Enter 用 {engine.label} 搜索「{query.trim()}」
              </div>
            )}

            <div className="map-search-modal__footer">
              <span><kbd>↑↓</kbd> 导航</span>
              <span><kbd>Enter</kbd> 确认</span>
              <span><kbd>Esc</kbd> 关闭</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
