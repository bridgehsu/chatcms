import { Button, Select } from "antd";
import type { DomainPolicy } from "@/types";
import {
  DOMAIN_POLICY_LABEL,
  DOMAIN_POLICIES,
  PERMISSION_DOMAINS,
} from "@/utils/permissionDomains";

const POLICY_OPTIONS = [
  { value: "" as const, label: "继承", tone: "inherit" },
  ...DOMAIN_POLICIES.map((p) => ({
    value: p,
    label: DOMAIN_POLICY_LABEL[p],
    tone: p,
  })),
] as const;

const PermField = ({
  value = {},
  onChange,
}: {
  value?: Record<string, DomainPolicy>;
  onChange?: (v: Record<string, DomainPolicy>) => void;
}) => {
  const set = (id: string, policy: DomainPolicy | "") => {
    const next = { ...value };
    if (!policy) delete next[id];
    else next[id] = policy as DomainPolicy;
    onChange?.(next);
  };

  const overrideCount = Object.keys(value).length;

  return (
    <div className="agent-perms">
      <div className="agent-perms__bar">
        <span className="agent-perms__summary">
          {overrideCount > 0
            ? `已覆盖 ${overrideCount} 项域策略`
            : "未覆盖，全部继承当前全局权限模式"}
        </span>
        {overrideCount > 0 ? (
          <Button
            type="link"
            size="small"
            className="agent-perms__reset"
            onClick={() => onChange?.({})}
          >
            重置全部
          </Button>
        ) : null}
      </div>

      <div className="agent-perms__grid">
        {PERMISSION_DOMAINS.map((d) => {
          const current = value[d.id] ?? "";
          const tone =
            POLICY_OPTIONS.find((o) => o.value === current)?.tone ?? "inherit";
          return (
            <div
              key={d.id}
              className={`agent-perms__cell agent-perms__cell--${tone}`}
            >
              <div className="agent-perms__meta">
                <span className="agent-perms__label">{d.label}</span>
                <span className="agent-perms__tip">{d.tip}</span>
              </div>
              <Select
                size="small"
                className="agent-perms__select"
                value={current}
                onChange={(v) => set(d.id, v)}
                popupMatchSelectWidth={false}
                options={POLICY_OPTIONS.map((o) => ({
                  value: o.value,
                  label: (
                    <span
                      className={`agent-perms__opt agent-perms__opt--${o.tone}`}
                    >
                      <i className="agent-perms__dot" aria-hidden />
                      {o.label}
                    </span>
                  ),
                }))}
                labelRender={({ value: v }) => {
                  const opt =
                    POLICY_OPTIONS.find((o) => o.value === v) ??
                    POLICY_OPTIONS[0];
                  return (
                    <span
                      className={`agent-perms__opt agent-perms__opt--${opt.tone}`}
                    >
                      <i className="agent-perms__dot" aria-hidden />
                      {opt.label}
                    </span>
                  );
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PermField;
