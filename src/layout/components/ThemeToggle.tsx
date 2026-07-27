import { IconMoon, IconSun } from "@/components/icons";
import { useThemeStore } from "@/stores/useThemeStore";

/** 侧栏外观切换：单击浅色 ↔ 深色，无弹出层。 */
export const ThemeToggle = () => {
  const preference = useThemeStore((s) => s.preference);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = preference === "dark";
  const label = isDark ? "切换到浅色" : "切换到深色";

  return (
    <button
      type="button"
      className="theme-switch"
      aria-label={label}
      title={label}
      onClick={() => toggle()}
    >
      <span className="theme-switch__icon" data-active={isDark ? "moon" : "sun"}>
        <span className="theme-switch__sun" aria-hidden="true">
          <IconSun />
        </span>
        <span className="theme-switch__moon" aria-hidden="true">
          <IconMoon />
        </span>
      </span>
    </button>
  );
};
