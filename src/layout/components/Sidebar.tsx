import { NavLink } from "react-router-dom";
import { NAV_ITEMS, SETTINGS_ITEM } from "@/layout/nav";

interface Props {
  onOpenSettings: () => void;
}

const NavIconLink = ({
  path,
  label,
  Icon,
  dividerBefore,
}: (typeof NAV_ITEMS)[number]) => (
  <div className="nav-slot">
    {dividerBefore && <div className="nav-divider" role="separator" />}
    <NavLink
      to={path}
      className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
      aria-label={label}
    >
      <span className="nav-icon">
        <Icon />
      </span>
      <span className="nav-tooltip" role="tooltip">
        {label}
      </span>
    </NavLink>
  </div>
);

export const Sidebar = ({ onOpenSettings }: Props) => {
  const { Icon, label } = SETTINGS_ITEM;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-brand" title="ChatCMS">
          C
        </span>
      </div>

      <nav className="nav-list" aria-label="主导航">
        {NAV_ITEMS.map((item) => (
          <NavIconLink key={item.path} {...item} />
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="nav-slot">
          <button
            type="button"
            className="nav-item"
            aria-label={label}
            onClick={onOpenSettings}
          >
            <span className="nav-icon">
              <Icon />
            </span>
            <span className="nav-tooltip" role="tooltip">
              {label}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};
