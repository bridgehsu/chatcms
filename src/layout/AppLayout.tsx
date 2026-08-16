import { Outlet } from "react-router-dom";
import { Sidebar } from "@/layout/components/Sidebar";

/** 主壳：侧栏 + 页面区（Topbar 由各页面业务自行实现） */
export const AppLayout = () => (
  <div className="app-layout">
    <Sidebar />
    <div className="main-area">
      <div className="page-outlet">
        <Outlet />
      </div>
    </div>
  </div>
);
