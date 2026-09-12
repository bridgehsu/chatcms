import { useParams } from "react-router-dom";
import { PageShell } from "@/layout/components/PageShell";
import { CrawlerPanel } from "./components/CrawlerPanel";

/** 媒体采集配置页：/crawler/new | /crawler/:taskId */
export const CrawlerConfigPage = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const isNew = !taskId || taskId === "new";

  return (
    <PageShell scroll={false}>
      <div className="page crawler-page">
        <CrawlerPanel taskId={isNew ? null : taskId} />
      </div>
    </PageShell>
  );
};
