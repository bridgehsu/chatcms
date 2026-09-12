import { useEffect, useState } from "react";
import { App as AntdApp, Table, Tag } from "antd";
import { PageShell } from "@/layout/components/PageShell";
import { invoke } from "@/hooks/useTauri";
import type { AuditDecision, AuditEvent } from "@/types";
import { formatTime } from "@/utils/time";

const DECISION_LABEL: Record<AuditDecision, { text: string; color: string }> = {
  allow_auto: { text: "自动允许", color: "success" },
  allow_user: { text: "用户允许", color: "success" },
  deny_user: { text: "用户拒绝", color: "error" },
  deny_policy: { text: "策略拒绝", color: "error" },
  deny_timeout: { text: "超时拒绝", color: "warning" },
  deny_constraint: { text: "约束拒绝", color: "error" },
};

const emitObsBusy = (busy: boolean) => {
  window.dispatchEvent(
    new CustomEvent("settings-obs:topbar-busy", { detail: { busy } }),
  );
};

/** 系统设置 · 运行观测 */
export const ObservabilityPage = () => {
  const { message } = AntdApp.useApp();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<AuditEvent[]>([]);

  const refresh = async () => {
    setBusy(true);
    emitObsBusy(true);
    try {
      const list = await invoke<AuditEvent[]>("permission_audit_list", {
        limit: 100,
      });
      setRows(list);
    } catch (e) {
      message.error(String(e));
    } finally {
      setBusy(false);
      emitObsBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    const onRequest = () => emitObsBusy(busy);
    window.addEventListener("settings-obs:refresh", onRefresh);
    window.addEventListener("settings-obs:topbar-request", onRequest);
    return () => {
      window.removeEventListener("settings-obs:refresh", onRefresh);
      window.removeEventListener("settings-obs:topbar-request", onRequest);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageShell>
      <div className="page">
        <Table<AuditEvent>
          rowKey="id"
          size="middle"
          loading={busy}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          dataSource={rows}
          locale={{ emptyText: "暂无审计记录；在会话中触发工具授权后会出现" }}
          columns={[
            {
              title: "时间",
              dataIndex: "ts",
              width: 168,
              render: (ts: number) => formatTime(ts * 1000),
            },
            {
              title: "裁决",
              dataIndex: "decision",
              width: 110,
              render: (d: AuditDecision) => {
                const meta = DECISION_LABEL[d] ?? {
                  text: d,
                  color: "default",
                };
                return <Tag color={meta.color}>{meta.text}</Tag>;
              },
            },
            {
              title: "工具",
              dataIndex: "tool_name",
              width: 120,
            },
            {
              title: "域",
              dataIndex: "domain",
              width: 100,
            },
            {
              title: "模式",
              dataIndex: "mode_name",
              width: 100,
              render: (v?: string) => v || "—",
            },
            {
              title: "摘要",
              dataIndex: "input_summary",
              ellipsis: true,
            },
            {
              title: "会话",
              dataIndex: "session_id",
              width: 100,
              ellipsis: true,
              render: (id: string) => id?.slice(0, 8) || "—",
            },
          ]}
        />
      </div>
    </PageShell>
  );
};
