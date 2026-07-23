import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layout/AppLayout";
import { ChatPage } from "@/views/chat";
import { MapPage } from "@/views/map";
import { ImagesPage } from "@/views/images";
import { VideosPage } from "@/views/videos";
import { AccountsPage } from "@/views/accounts";
import { CronPage } from "@/views/cron";
import { SkillsPage } from "@/views/skills";
import { AgentsPage } from "@/views/agents";
import { McpPage } from "@/views/mcp";
import { ModelConfigPage } from "@/views/model-config";

const App = () => (
  <HashRouter>
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="images" element={<ImagesPage />} />
        <Route path="videos" element={<VideosPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="cron" element={<CronPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="mcp" element={<McpPage />} />
        <Route path="models" element={<ModelConfigPage />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Route>
    </Routes>
  </HashRouter>
);

export default App;
