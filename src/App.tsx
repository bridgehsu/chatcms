import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layout/AppLayout";
import { CrawlerPage } from "@/views/crawler";
import { ChatPage } from "@/views/chat";
import { MapPage } from "@/views/map";
import { NavBookmarksPage } from "@/views/nav";
import { ContentPage } from "@/views/content";
import { ImagesPage, ImageGeneratePage } from "@/views/images";
import { VideosPage, VideoGeneratePage, VideoStudioPage } from "@/views/videos";
import { AccountsPage } from "@/views/accounts";
import {
  MediaPlatformsPage,
  MediaScriptPage,
  CollectScriptPage,
} from "@/views/media-platforms";
import { SchedulesPage, WorkflowEditorPage } from "@/views/schedules";
import { SkillsPage } from "@/views/skills";
import { AgentsPage } from "@/views/agents";
import { McpPage } from "@/views/mcp";
import { ModelsPage } from "@/views/models";
import { ChannelsPage } from "@/views/settings/ChannelsPage";
import { KnowledgePage } from "@/views/settings/KnowledgePage";
import {
  PermissionsRedirect,
  SettingsPermissionsPage,
} from "@/views/settings/PermissionsPage";

const App = () => (
  <HashRouter>
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="nav" element={<NavBookmarksPage />} />
        <Route path="content" element={<ContentPage />} />
        <Route path="images" element={<ImagesPage />} />
        <Route path="images/generate" element={<ImageGeneratePage />} />
        <Route path="videos" element={<VideosPage />} />
        <Route path="videos/generate" element={<VideoGeneratePage />} />
        <Route path="videos/studio" element={<VideoStudioPage />} />
        <Route path="media-platforms" element={<MediaPlatformsPage />} />
        <Route
          path="media-platforms/:platformId/script"
          element={<MediaScriptPage />}
        />
        <Route
          path="media-platforms/:platformId/collect-script"
          element={<CollectScriptPage />}
        />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="crawler" element={<CrawlerPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="schedules/:projectId" element={<WorkflowEditorPage />} />
        <Route path="cron" element={<Navigate to="/schedules" replace />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="mcp" element={<McpPage />} />
        <Route path="models" element={<ModelsPage />} />
        <Route path="settings/permissions" element={<SettingsPermissionsPage />} />
        <Route path="settings/knowledge" element={<KnowledgePage />} />
        <Route path="settings/channels" element={<ChannelsPage />} />
        <Route path="permissions" element={<PermissionsRedirect />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Route>
    </Routes>
  </HashRouter>
);

export default App;
