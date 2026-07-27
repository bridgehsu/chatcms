import { Outlet } from "react-router-dom";
import { Sidebar } from "@/layout/components/Sidebar";
import { Topbar } from "@/layout/components/Topbar";

/** 主壳：侧栏 + 顶栏 + 页面区 */
export const AppLayout = () => (
  <div className="app-layout">
    <Sidebar />
    <div className="main-area">
      <Topbar />
      <div className="page-outlet">
        <Outlet />
      </div>
    </div>
  </div>
);
