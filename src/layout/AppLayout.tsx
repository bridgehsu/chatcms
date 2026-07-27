import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/layout/components/Sidebar";
import { Topbar } from "@/layout/components/Topbar";
import { SettingsModal } from "@/layout/components/SettingsModal";

/** 主壳：侧栏 + 顶栏 + 页面区 + 壳级弹窗 */
export const AppLayout = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />

      <div className="main-area">
        <Topbar />
        <div className="page-outlet">
          <Outlet />
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};
