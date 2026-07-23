import type { MapDeadline } from "../types";

type Props = {
  items: MapDeadline[];
};

export const MapDeadlineBar = ({ items }: Props) => (
  <div className="map-deadline-bar" aria-label="里程碑">
    {items.map((item, i) => (
      <span
        key={item.id}
        className={`map-deadline-chip${i === 0 ? " is-primary" : ""}`}
      >
        {i === 0 ? item.label : `${item.label} · ${item.days} 天`}
      </span>
    ))}
  </div>
);
