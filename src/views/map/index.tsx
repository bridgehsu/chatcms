import { PageShell } from "@/layout/components/PageShell";
import { MapBoard } from "./components/MapBoard";

/** 业务地图 */
export const MapPage = () => (
  <PageShell>
    <div className="page map-page">
      <MapBoard />
    </div>
  </PageShell>
);
