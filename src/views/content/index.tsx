import { PageShell } from "@/layout/components/PageShell";
import { NotesWorkspace } from "./components/NotesWorkspace";

/** 内容管理 · AI 笔记 */
export const ContentPage = () => (
  <PageShell scroll={false}>
    <div className="page content-page">
      <NotesWorkspace />
    </div>
  </PageShell>
);
