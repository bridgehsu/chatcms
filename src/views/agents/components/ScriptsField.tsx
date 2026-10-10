import { Badge, Button, Checkbox, Space, Tag } from "antd";
import type { AgentChannelScript } from "@/types";

const ScriptsField = ({
  value = [],
  onChange,
  options,
}: {
  value?: string[];
  onChange?: (v: string[]) => void;
  options: AgentChannelScript[];
}) => {
  const selected = value ?? [];
  const selectedCount = selected.length;
  const allKeys = options.map((o) => o.key);
  const isAllSelected =
    allKeys.length > 0 && selectedCount === allKeys.length;

  return (
    <div className="agent-skills">
      <div className="agent-skills__panel">
        {options.length > 0 ? (
          <div className="agent-skills__toolbar">
            <span className="agent-skills__count">
              {selectedCount > 0
                ? `已绑 ${selectedCount} / ${allKeys.length}`
                : "勾选插件侧可运行的渠道脚本"}
              {selectedCount > 0 ? (
                <Badge
                  count={selectedCount}
                  size="small"
                  className="agent-skills__badge"
                />
              ) : null}
            </span>
            <Space size={8}>
              <Button
                type="link"
                size="small"
                className="agent-skills__link"
                onClick={() => onChange?.(allKeys)}
                disabled={isAllSelected}
              >
                全选
              </Button>
              <Button
                type="link"
                size="small"
                className="agent-skills__link"
                onClick={() => onChange?.([])}
                disabled={selectedCount === 0}
              >
                清空
              </Button>
            </Space>
          </div>
        ) : null}

        <div className="agent-skills__list">
          {options.length === 0 ? (
            <p className="agent-skills__empty">
              暂无可用脚本，请先到「渠道中心 → 插件脚本」创建并启用
            </p>
          ) : (
            <Checkbox.Group
              value={selected}
              onChange={(checked) => onChange?.(checked as string[])}
              className="agent-skills__checks"
            >
              {options.map((o) => {
                const isRead =
                  o.kind === "script" ||
                  o.kind === "collect" ||
                  o.role === "read";
                return (
                  <Checkbox
                    key={o.key}
                    value={o.key}
                    className={`agent-skills__item${
                      selected.includes(o.key) ? " is-on" : ""
                    }`}
                  >
                    <span className="agent-skills__item-body">
                      <span className="agent-skills__item-name">
                        {o.label}
                        <Tag
                          className="agent-scripts__tag"
                          color={isRead ? "blue" : "green"}
                        >
                          {isRead ? "运行" : "填表"}
                        </Tag>
                      </span>
                      <span className="agent-skills__item-desc">
                        {o.code}
                        {o.version > 0 ? ` · v${o.version}` : ""}
                      </span>
                    </span>
                  </Checkbox>
                );
              })}
            </Checkbox.Group>
          )}
        </div>
      </div>
      <p className="agent-skills__hint">
        绑定后，浏览器插件选中该角色时可在输入框用 @ 引用脚本，经会话由 Agent
        调用执行。
      </p>
    </div>
  );
};

export default ScriptsField;
