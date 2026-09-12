import { Navigate } from "react-router-dom";
import { PageShell } from "@/layout/components/PageShell";
import { PermissionsPanel } from "@/views/permissions/components/PermissionsPanel";

/** 系统设置 · 权限管理 */
export const SettingsPermissionsPage = () => (
  <PageShell>
    <div className="page">
      <PermissionsPanel />
    </div>
  </PageShell>
);

/** 旧路径 /permissions → 系统设置 */
export const PermissionsRedirect = () => (
  <Navigate to="/settings/permissions" replace />
);
