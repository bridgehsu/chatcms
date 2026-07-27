import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { IconChevron, IconSidebar } from "@/components/icons";
import {
  groupContainsPath,
  NAV_ENTRIES,
  type NavGroup,
  type NavLeaf,
} from "@/layout/nav";

const SIDEBAR_KEY = "chatcms.sidebar.expanded.v2";
const GROUPS_KEY = "chatcms.sidebar.groups.v1";

const readGroupOpen = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (!raw) return { workspace: true, settings: true };
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return { workspace: true, settings: true, ...parsed };
  } catch {
    return { workspace: true, settings: true };
  }
};

const LeafLink = ({
  path,
  label,
  Icon,
  dividerBefore,
  sidebarExpanded,
  nested,
}: {
  path: string;
  label: string;
  Icon: NavLeaf["Icon"];
  dividerBefore?: boolean;
  sidebarExpanded: boolean;
  nested?: boolean;
}) => (
  <div className={`nav-slot${nested ? " nav-slot--nested" : ""}`}>
    {dividerBefore ? <div className="nav-divider" role="separator" /> : null}
    <NavLink
      to={path}
      className={({ isActive }) =>
        `nav-item${nested ? " nav-item--nested" : ""}${isActive ? " active" : ""}`
      }
      aria-label={label}
      title={sidebarExpanded ? undefined : label}
      end={path !== "/schedules"}
    >
      <span className="nav-icon">
        <Icon />
      </span>
      <span className="nav-label">{label}</span>
      {!sidebarExpanded ? (
        <span className="nav-tooltip" role="tooltip">
          {label}
        </span>
      ) : null}
    </NavLink>
  </div>
);

const GroupBlock = ({
  group,
  sidebarExpanded,
  open,
  onToggle,
}: {
  group: NavGroup;
  sidebarExpanded: boolean;
  open: boolean;
  onToggle: () => void;
}) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = groupContainsPath(group, pathname);
  const showChildren = sidebarExpanded && open;

  const onParentClick = () => {
    if (!sidebarExpanded) {
      navigate(group.defaultPath);
      return;
    }
    if (!open) {
      onToggle();
      if (!active) navigate(group.defaultPath);
      return;
    }
    if (!active) navigate(group.defaultPath);
    else onToggle();
  };

  return (
    <div
      className={`nav-group${active ? " is-active" : ""}${open ? " is-open" : ""}`}
    >
      {group.dividerBefore ? (
        <div className="nav-divider" role="separator" />
      ) : null}
      <button
        type="button"
        className={`nav-item nav-item--group${active ? " active" : ""}`}
        aria-label={group.label}
        aria-expanded={showChildren}
        title={sidebarExpanded ? undefined : group.label}
        onClick={onParentClick}
      >
        <span className="nav-icon">
          <group.Icon />
        </span>
        <span className="nav-label">{group.label}</span>
        {sidebarExpanded ? (
          <span className="nav-group__chevron" aria-hidden="true">
            <IconChevron open={open} />
          </span>
        ) : (
          <span className="nav-tooltip" role="tooltip">
            {group.label}
          </span>
        )}
      </button>
      {showChildren ? (
        <div className="nav-group__children" role="group" aria-label={group.label}>
          {group.children.map((c) => (
            <LeafLink
              key={c.path}
              path={c.path}
              label={c.label}
              Icon={c.Icon}
              sidebarExpanded={sidebarExpanded}
              nested
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const Sidebar = () => {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_KEY);
      if (saved === null) return true;
      return saved === "1";
    } catch {
      return true;
    }
  });
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(readGroupOpen);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, expanded ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [expanded]);

  useEffect(() => {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(groupOpen));
    } catch {
      /* ignore */
    }
  }, [groupOpen]);

  // 路由命中时自动展开对应分组
  useEffect(() => {
    setGroupOpen((prev) => {
      let next = prev;
      for (const e of NAV_ENTRIES) {
        if (e.kind !== "group") continue;
        if (groupContainsPath(e, pathname) && !prev[e.id]) {
          next = { ...next, [e.id]: true };
        }
      }
      return next;
    });
  }, [pathname]);

  const toggleGroup = (id: string) => {
    setGroupOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const entries = useMemo(() => NAV_ENTRIES, []);

  return (
    <aside className={`sidebar${expanded ? " is-expanded" : ""}`}>
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-brand"
          title="ChatCMS"
          aria-label="ChatCMS"
          onClick={() => setExpanded((v) => !v)}
        >
          C
        </button>
        {expanded ? <span className="sidebar-brand-text">ChatCMS</span> : null}
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={expanded ? "收起导航" : "展开导航"}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <IconSidebar />
        </button>
      </div>

      <nav className="nav-list" aria-label="主导航">
        {entries.map((entry) =>
          entry.kind === "leaf" ? (
            <LeafLink
              key={entry.path}
              path={entry.path}
              label={entry.label}
              Icon={entry.Icon}
              dividerBefore={entry.dividerBefore}
              sidebarExpanded={expanded}
            />
          ) : (
            <GroupBlock
              key={entry.id}
              group={entry}
              sidebarExpanded={expanded}
              open={!!groupOpen[entry.id]}
              onToggle={() => toggleGroup(entry.id)}
            />
          ),
        )}
      </nav>
    </aside>
  );
};
