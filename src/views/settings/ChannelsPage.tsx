import { PageShell } from "@/layout/components/PageShell";
import { ChannelPanel } from "./components/ChannelPanel";

/** 系统设置 · 渠道列表 */
export const ChannelsPage = () => (
  <PageShell>
    <div className="page">
      <ChannelPanel />
    </div>
  </PageShell>
);
