import { PageShell } from "@/layout/components/PageShell";
import { VideosBoard } from "./components/VideosBoard";

export { VideoGeneratePage } from "./components/VideoGeneratePage";
export { VideoStudioPage } from "./components/VideoStudioPage";

/** 视频工厂 · 列表素材库 */
export const VideosPage = () => (
  <PageShell>
    <div className="page">
      <VideosBoard />
    </div>
  </PageShell>
);
