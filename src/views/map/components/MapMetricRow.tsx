import type { MapMetric } from "../types";

type Props = {
  metrics: MapMetric[];
};

export const MapMetricRow = ({ metrics }: Props) => (
  <section className="map-section map-metrics">
    <header className="map-section__header">
      <div className="map-section__title-wrap">
        <span className="map-section__icon" aria-hidden="true">
          ▦
        </span>
        <h2 className="map-section__title">运营速览</h2>
      </div>
    </header>
    <div className="map-section__body">
      <div className="map-metric-row">
        {metrics.map((m) => (
          <div key={m.id} className={`map-metric map-metric--${m.trend}`}>
            <span className="map-metric__label">{m.label}</span>
            <span className="map-metric__value">{m.value}</span>
            <span className="map-metric__change">{m.change}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);
