import { Navigate } from "react-router-dom";
import { PermissionsPanel } from "@/views/permissions/components/PermissionsPanel";

/** 系统设置 · 权限 */
export const SettingsPermissionsPage = () => (
  <div className="page page-scroll">
    <PermissionsPanel />
  </div>
);

/** 旧路径 /permissions → 系统设置 */
export const PermissionsRedirect = () => (
  <Navigate to="/settings/permissions" replace />
);
