import { useLocation } from "react-router-dom";
import { titleForPath } from "@/layout/nav";

export const Topbar = () => {
  const { pathname } = useLocation();
  return (
    <header className="topbar">
      <h1 className="topbar-title">{titleForPath(pathname)}</h1>
    </header>
  );
};
