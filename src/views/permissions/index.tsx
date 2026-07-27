import { Navigate } from "react-router-dom";

/** @deprecated 使用 /settings/permissions */
export const PermissionsPage = () => (
  <Navigate to="/settings/permissions" replace />
);
