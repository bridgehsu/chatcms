import { useEffect, useState } from "react";

type Zone = {
  id: string;
  label: string;
  abbr: string;
  timeZone: string;
};

const ZONES: Zone[] = [
  { id: "cn", label: "北京", abbr: "BJ", timeZone: "Asia/Shanghai" },
  { id: "us-e", label: "美东", abbr: "NY", timeZone: "America/New_York" },
  { id: "us-w", label: "美西", abbr: "LA", timeZone: "America/Los_Angeles" },
  { id: "th", label: "泰国", abbr: "BK", timeZone: "Asia/Bangkok" },
  { id: "eu", label: "欧洲", abbr: "EU", timeZone: "Europe/Berlin" },
  { id: "jp", label: "日本", abbr: "TK", timeZone: "Asia/Tokyo" },
];

const getDay = (timeZone: string, now: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

const formatDate = (now: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

const formatTime = (timeZone: string, now: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

const dayDiff = (now: Date, timeZone: string): number => {
  const bjDay = new Date(getDay("Asia/Shanghai", now));
  const tzDay = new Date(getDay(timeZone, now));
  return Math.round((tzDay.getTime() - bjDay.getTime()) / 86400000);
};

export const MapWorldClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <section className="map-card map-clock">
      <header className="map-section__header">
        <h2 className="map-section__title">世界时钟</h2>
        <span className="map-clock__date">{formatDate(now)}</span>
      </header>
      <div className="map-clock__list">
        {ZONES.map((z) => {
          const diff = dayDiff(now, z.timeZone);
          return (
            <div key={z.id} className="map-clock__row">
              <span className="map-clock__abbr">{z.abbr}</span>
              <span className="map-clock__label">{z.label}</span>
              <span className="map-clock__time">
                {formatTime(z.timeZone, now)}
                {diff !== 0 && (
                  <span className={`map-clock__diff${diff > 0 ? " is-next" : " is-prev"}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
