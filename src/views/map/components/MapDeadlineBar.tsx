import { useCallback, useEffect, useRef } from "react";
import type { MapDeadline } from "../types";

type Props = {
  items: MapDeadline[];
};

const Chips = ({ holidays, suffix }: { holidays: MapDeadline[]; suffix: string }) => (
  <>
    {holidays.map((item, i) => (
      <span
        key={item.id + suffix}
        className={[
          "map-deadline-chip",
          i === 0 ? "is-nearest" : "",
          i === holidays.length - 1 ? "is-farthest" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {item.label}
        <em>{item.days} 天</em>
      </span>
    ))}
    <span className="map-deadline-loop-sep" aria-hidden="true" />
  </>
);

const SPEED = 0.5;

export const MapDeadlineBar = ({ items }: Props) => {
  const [yearItem, ...holidays] = items;

  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const posRef = useRef(0);
  const paused = useRef(false);

  const tick = useCallback(() => {
    const track = trackRef.current;
    if (track && !paused.current) {
      const half = track.scrollWidth / 2;
      if (half > 0) {
        posRef.current += SPEED;
        if (posRef.current >= half) posRef.current -= half;
        track.style.transform = `translateX(-${posRef.current}px)`;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  return (
    <div className="map-deadline-bar" aria-label="里程碑">
      <span className="map-deadline-chip is-primary">{yearItem?.label}</span>
      <div className="map-deadline-divider" />
      <div
        className="map-deadline-holidays"
        onMouseEnter={() => { paused.current = true; }}
        onMouseLeave={() => { paused.current = false; }}
      >
        <div ref={trackRef} className="map-deadline-track">
          <Chips holidays={holidays} suffix="a" />
          <Chips holidays={holidays} suffix="b" />
        </div>
      </div>
    </div>
  );
};
