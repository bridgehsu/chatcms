import { Select } from "@/components/Select";
import type { ChatMode } from "@/types";

const MODE_OPTIONS: { value: ChatMode; label: string }[] = [
  { value: "ask", label: "Ask" },
  { value: "agent", label: "Agent" },
  { value: "search", label: "Search" },
];

type Props = {
  value: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
};

/** Ask / Agent / Search 下拉（样式对齐 composer 权限/模型选择） */
export const ModePicker = ({ value, onChange, disabled }: Props) => (
  <Select
    className="composer__mode"
    aria-label="选择会话模式"
    placement="top"
    value={value}
    options={MODE_OPTIONS}
    onChange={(v) => {
      if (disabled) return;
      onChange(v);
    }}
  />
);
