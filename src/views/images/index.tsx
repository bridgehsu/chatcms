import { PageShell } from "@/layout/components/PageShell";
import { ImagesBoard } from "./components/ImagesBoard";

export { ImageGeneratePage } from "./components/ImageGeneratePage";

/** 图片工厂 · 列表素材库 */
export const ImagesPage = () => (
  <PageShell>
    <div className="page">
      <ImagesBoard />
    </div>
  </PageShell>
);
