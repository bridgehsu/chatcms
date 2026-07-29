import { ImagesBoard } from "./components/ImagesBoard";

export { ImageGeneratePage } from "./components/ImageGeneratePage";

/** 图片管理 · 列表素材库 */
export const ImagesPage = () => (
  <div className="page page-scroll">
    <ImagesBoard />
  </div>
);
