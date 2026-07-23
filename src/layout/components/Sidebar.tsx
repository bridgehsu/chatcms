import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { IconSidebar } from "@/components/icons";
import { NAV_ITEMS, SETTINGS_ITEM } from "@/layout/nav";

interface Props {
  onOpenSettings: () => void;
}

const STORAGE_KEY = "chatcms.sidebar.expanded.v2";

const NavIconLink = ({
  path,
  label,
  Icon,
  dividerBefore,
  expanded,
}: (typeof NAV_ITEMS)[number] & { expanded: boolean }) => (
  <div className="nav-slot">
    {dividerBefore && <div className="nav-divider" role="separator" />}
    <NavLink
      to={path}
      className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
      aria-label={label}
      title={expanded ? undefined : label}
    >
      <span className="nav-icon">
        <Icon />
      </span>
      <span className="nav-label">{label}</span>
      {!expanded && (
        <span className="nav-tooltip" role="tooltip">
          {label}
        </span>
      )}
    </NavLink>
  </div>
);

export const Sidebar = ({ onOpenSettings }: Props) => {
  const { Icon, label } = SETTINGS_ITEM;
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) return true;
      return saved === "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [expanded]);

  const toggle = () => setExpanded((v) => !v);

  return (
    <aside className={`sidebar${expanded ? " is-expanded" : ""}`}>
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-brand"
          title="ChatCMS"
          aria-label="ChatCMS"
          onClick={toggle}
        >
          C
        </button>
        {expanded && <span className="sidebar-brand-text">ChatCMS</span>}
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={expanded ? "收起导航" : "展开导航"}
          aria-expanded={expanded}
          onClick={toggle}
        >
          <IconSidebar />
        </button>
      </div>

      <nav className="nav-list" aria-label="主导航">
        {NAV_ITEMS.map((item) => (
          <NavIconLink key={item.path} {...item} expanded={expanded} />
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="nav-slot">
          <button
            type="button"
            className="nav-item"
            aria-label={label}
            title={expanded ? undefined : label}
            onClick={onOpenSettings}
          >
            <span className="nav-icon">
              <Icon />
            </span>
            <span className="nav-label">{label}</span>
            {!expanded && (
              <span className="nav-tooltip" role="tooltip">
                {label}
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
