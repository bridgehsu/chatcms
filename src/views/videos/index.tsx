import { VideosBoard } from "./components/VideosBoard";

export { VideoGeneratePage } from "./components/VideoGeneratePage";

/** 视频管理 · 列表素材库 */
export const VideosPage = () => (
  <div className="page page-scroll">
    <VideosBoard />
  </div>
);
