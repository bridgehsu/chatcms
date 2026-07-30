import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  IconChevron,
  IconGithub,
  IconGlobe,
  IconLogout,
  IconNav,
  IconPencil,
  IconSidebar,
  IconTrash,
} from "@/components/icons";
import { ThemeToggle } from "./ThemeToggle";
import {
  groupContainsPath,
  NAV_ENTRIES,
  type NavGroup,
  type NavLeaf,
} from "@/layout/nav";
import { useCustomNav, type CustomNavEntry } from "../hooks/useCustomNav";
import { NavCustomModal } from "./NavCustomModal";

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
  onEdit,
  onRemove,
}: {
  path: string;
  label: string;
  Icon: NavLeaf["Icon"];
  dividerBefore?: boolean;
  sidebarExpanded: boolean;
  nested?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}) => (
  <div className={`nav-slot${nested ? " nav-slot--nested" : ""}`}>
    {dividerBefore ? <div className="nav-divider" role="separator" /> : null}
    <NavLink
      to={path}
      className={({ isActive }) =>
        `nav-item${nested ? " nav-item--nested" : ""}${isActive ? " active" : ""}${onEdit || onRemove ? " nav-item--custom" : ""}`
      }
      aria-label={label}
      title={sidebarExpanded ? undefined : label}
      end
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
      {sidebarExpanded && (onEdit || onRemove) ? (
        <span
          className="nav-item__edit-actions"
          onClick={(e) => e.preventDefault()}
        >
          {onEdit ? (
            <button
              type="button"
              className="nav-edit-btn"
              aria-label="编辑"
              onClick={(e) => { e.preventDefault(); onEdit(); }}
            >
              <IconPencil />
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              className="nav-edit-btn nav-edit-btn--danger"
              aria-label="删除"
              onClick={(e) => { e.preventDefault(); onRemove(); }}
            >
              <IconTrash />
            </button>
          ) : null}
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
    <div className={`nav-group${active ? " is-active" : ""}${open ? " is-open" : ""}`}>
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
  const [modal, setModal] = useState<"add" | CustomNavEntry | null>(null);

  const { entries: customEntries, add, update, remove } = useCustomNav();

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, expanded ? "1" : "0");
    } catch { /* ignore */ }
  }, [expanded]);

  useEffect(() => {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(groupOpen));
    } catch { /* ignore */ }
  }, [groupOpen]);

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
    <>
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

          {customEntries.length > 0 ? (
            <div className="nav-divider" role="separator" />
          ) : null}
          {customEntries.map((entry) => (
            <LeafLink
              key={entry.id}
              path={entry.path}
              label={entry.label}
              Icon={IconNav}
              sidebarExpanded={expanded}
              onEdit={() => setModal(entry)}
              onRemove={() => remove(entry.id)}
            />
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className="sidebar-icon-btn sidebar-icon-btn--logout"
            aria-label="退出"
            title="退出"
          >
            <IconLogout />
          </button>
          <div className="sidebar-bottom__utils">
            <ThemeToggle />
            <a
              href="https://github.com/chatcms"
              target="_blank"
              rel="noreferrer"
              className="sidebar-icon-btn"
              aria-label="GitHub"
              title="GitHub"
            >
              <IconGithub />
            </a>
            <a
              href="https://chatcms.org"
              target="_blank"
              rel="noreferrer"
              className="sidebar-icon-btn"
              aria-label="官网"
              title="官网"
            >
              <IconGlobe />
            </a>
          </div>
        </div>
      </aside>

      {modal !== null ? (
        <NavCustomModal
          entry={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSave={(label, path, sortOrder) => {
            if (modal === "add") {
              add(label, path, sortOrder);
            } else {
              update(modal.id, label, path, sortOrder);
            }
          }}
        />
      ) : null}
    </>
  );
};
