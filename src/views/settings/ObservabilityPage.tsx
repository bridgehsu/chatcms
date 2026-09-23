import { useEffect, useMemo, useState } from "react";
import { App as AntdApp, Drawer, Tabs, Tag } from "antd";
import CabinX, { ActionOverflow, type CabinXColumn } from "@/components/CabinX";
import { PageShell } from "@/layout/components/PageShell";
import { invoke } from "@/hooks/useTauri";
import type { AuditDecision, AuditEvent, ChatTurnTrace, TracePhase } from "@/types";
import { formatTime } from "@/utils/time";

const DECISION_LABEL: Record<AuditDecision, { text: string; color: string }> = {
  allow_auto: { text: "自动允许", color: "success" },
  allow_user: { text: "用户允许", color: "success" },
  deny_user: { text: "用户拒绝", color: "error" },
  deny_policy: { text: "策略拒绝", color: "error" },
  deny_timeout: { text: "超时拒绝", color: "warning" },
  deny_constraint: { text: "约束拒绝", color: "error" },
};

const PHASE_LABEL: Record<string, string> = {
  entry: "入口",
  ensure_session: "建会话",
  push_user_message: "落库用户消息",
  intent: "意图识别",
  build_system_prompt: "组装 System",
  pick_model: "选择模型",
  prepare_request: "组消息/工具",
  provider_stream: "模型流式",
  tool_round: "工具轮",
  aborted: "已中断",
  total: "合计",
};

const emitObsBusy = (busy: boolean) => {
  window.dispatchEvent(
    new CustomEvent("settings-obs:topbar-busy", { detail: { busy } }),
  );
};

const ms = (v: number | null | undefined) =>
  v == null ? "—" : `${v} ms`;

/** 结论区总耗时：≥1s 显示秒，否则毫秒 */
const formatTotal = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v} ms`;

const pageSlice = <T,>(
  list: T[],
  pageNum = 1,
  pageSize = 20,
): { list: T[]; total: number; pageNum: number; pageSize: number } => {
  const start = (pageNum - 1) * pageSize;
  return {
    list: list.slice(start, start + pageSize),
    total: list.length,
    pageNum,
    pageSize,
  };
};

const TraceWaterfall = ({
  phases,
  totalMs,
}: {
  phases: TracePhase[];
  totalMs: number;
}) => {
  const scale = Math.max(totalMs, 1);
  const rows = phases.filter((p) => p.name !== "total");
  const maxDur = Math.max(0, ...rows.map((p) => p.duration_ms || 0));

  return (
    <div className="trace-timeline">
      {rows.map((p, i) => {
        const dur = p.duration_ms || 0;
        const end = p.elapsed_ms || 0;
        const start = Math.max(0, end - dur);
        const left = Math.min(100, (start / scale) * 100);
        const width = Math.max(
          dur > 0 ? 0.8 : 0,
          Math.min(100 - left, (dur / scale) * 100),
        );
        const pct = Math.round((dur / scale) * 1000) / 10; // 保留 0.1%
        const isHot = maxDur > 0 && dur === maxDur && dur > 0;
        return (
          <div
            key={`${p.name}-${i}`}
            className={`trace-timeline__item${isHot ? " is-hot" : ""}`}
          >
            <div className="trace-timeline__rail" aria-hidden>
              <span className="trace-timeline__dot" />
            </div>
            <div className="trace-timeline__body">
              <div className="trace-timeline__meta">
                <span className="trace-timeline__name">
                  {PHASE_LABEL[p.name] ?? p.name}
                  {isHot ? (
                    <span className="trace-timeline__hot">最慢</span>
                  ) : null}
                </span>
                <span className="trace-timeline__ms">
                  {dur} ms
                  <span className="trace-timeline__pct"> · {pct}%</span>
                </span>
              </div>
              <div className="trace-timeline__track">
                <div
                  className="trace-timeline__bar"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              {p.detail ? (
                <p className="trace-timeline__detail">{p.detail}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TraceDetail = ({ detail }: { detail: ChatTurnTrace }) => (
  <div className="trace-detail">
    <section
      className={`trace-hero${detail.ok ? "" : " trace-hero--fail"}`}
    >
      <div className="trace-hero__main">
        <Tag color={detail.ok ? "success" : "error"}>
          {detail.ok ? "成功" : "失败"}
        </Tag>
        <div className="trace-hero__total">
          <span className="trace-hero__total-val">
            {formatTotal(detail.total_ms)}
          </span>
          <span className="trace-hero__total-label">总耗时</span>
        </div>
      </div>
      <div className="trace-hero__metrics">
        <div>
          <span className="trace-hero__k">首字 TTFT</span>
          <span className="trace-mono">{ms(detail.ttft_ms)}</span>
        </div>
        <div>
          <span className="trace-hero__k">HTTP 建连</span>
          <span className="trace-mono">{ms(detail.http_ms)}</span>
        </div>
        <div>
          <span className="trace-hero__k">出字后</span>
          <span className="trace-mono">{ms(detail.stream_ms)}</span>
        </div>
      </div>
    </section>

    {detail.error ? (
      <p className="trace-detail__error">{detail.error}</p>
    ) : null}

    <section className="trace-panel">
      <header className="trace-panel__head">
        <h3 className="trace-panel__title">请求上下文</h3>
      </header>
      <dl className="trace-ctx">
        <div className="trace-ctx__row">
          <dt>模型</dt>
          <dd>{detail.model || "—"}</dd>
        </div>
        <div className="trace-ctx__row">
          <dt>Base URL</dt>
          <dd className="trace-mono">{detail.base_url || "—"}</dd>
        </div>
        <div className="trace-ctx__row">
          <dt>模式</dt>
          <dd>{detail.chat_mode || "—"}</dd>
        </div>
        <div className="trace-ctx__row">
          <dt>意图</dt>
          <dd>
            {detail.intent_kind || "—"}
            {detail.needs_tools ? (
              <Tag className="trace-ctx__tag">needs_tools</Tag>
            ) : null}
          </dd>
        </div>
        <div className="trace-ctx__row">
          <dt>Tools / 轮次</dt>
          <dd>
            {detail.tools_count} / {detail.tool_rounds}
          </dd>
        </div>
        <div className="trace-ctx__row">
          <dt>Tokens</dt>
          <dd>
            in {detail.input_tokens} · out {detail.output_tokens}
          </dd>
        </div>
        <div className="trace-ctx__row">
          <dt>System 字符</dt>
          <dd>{detail.system_chars}</dd>
        </div>
        <div className="trace-ctx__row">
          <dt>会话</dt>
          <dd className="trace-mono">{detail.session_id}</dd>
        </div>
        <div className="trace-ctx__row">
          <dt>时间</dt>
          <dd>{formatTime(detail.ts)}</dd>
        </div>
      </dl>
    </section>

    <section className="trace-panel">
      <header className="trace-panel__head">
        <h3 className="trace-panel__title">阶段时间轴</h3>
        <span className="trace-panel__hint">相对总耗时定位</span>
      </header>
      <div className="trace-panel__body">
        <TraceWaterfall phases={detail.phases} totalMs={detail.total_ms} />
      </div>
    </section>
  </div>
);

/** 系统设置 · 运行观测（权限审计 + 会话链路） */
export const ObservabilityPage = () => {
  const { message } = AntdApp.useApp();
  const [tab, setTab] = useState("trace");
  const [refreshKey, setRefreshKey] = useState(0);
  const [detail, setDetail] = useState<ChatTurnTrace | null>(null);

  const refresh = () => {
    emitObsBusy(true);
    setRefreshKey((k) => k + 1);
    window.setTimeout(() => emitObsBusy(false), 400);
  };

  useEffect(() => {
    const onRefresh = () => refresh();
    const onRequest = () => emitObsBusy(false);
    window.addEventListener("settings-obs:refresh", onRefresh);
    window.addEventListener("settings-obs:topbar-request", onRequest);
    return () => {
      window.removeEventListener("settings-obs:refresh", onRefresh);
      window.removeEventListener("settings-obs:topbar-request", onRequest);
    };
  }, []);

  const traceApi = useMemo(
    () => ({
      paging: async (params: { pageNum?: number; pageSize?: number }) => {
        void refreshKey;
        try {
          const list = await invoke<ChatTurnTrace[]>("chat_trace_list", {
            limit: 200,
          });
          return pageSlice(list, params.pageNum, params.pageSize ?? 20);
        } catch (e) {
          message.error(String(e));
          return pageSlice([], params.pageNum, params.pageSize ?? 20);
        }
      },
    }),
    [refreshKey, message],
  );

  const auditApi = useMemo(
    () => ({
      paging: async (params: { pageNum?: number; pageSize?: number }) => {
        void refreshKey;
        try {
          const list = await invoke<AuditEvent[]>("permission_audit_list", {
            limit: 200,
          });
          return pageSlice(list, params.pageNum, params.pageSize ?? 20);
        } catch (e) {
          message.error(String(e));
          return pageSlice([], params.pageNum, params.pageSize ?? 20);
        }
      },
    }),
    [refreshKey, message],
  );

  const traceColumns: CabinXColumn<ChatTurnTrace>[] = useMemo(
    () => [
      {
        title: "时间",
        dataIndex: "ts",
        key: "ts",
        width: 168,
        render: (ts: number) => formatTime(ts),
      },
      {
        title: "状态",
        dataIndex: "ok",
        key: "ok",
        width: 80,
        render: (ok: boolean) =>
          ok ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>,
      },
      {
        title: "总耗时",
        dataIndex: "total_ms",
        key: "total_ms",
        width: 100,
        render: (v: number) => <span className="trace-mono">{ms(v)}</span>,
      },
      {
        title: "TTFT",
        dataIndex: "ttft_ms",
        key: "ttft_ms",
        width: 90,
        render: (v: number | null) => (
          <span className="trace-mono">{ms(v)}</span>
        ),
      },
      {
        title: "HTTP",
        dataIndex: "http_ms",
        key: "http_ms",
        width: 90,
        render: (v: number | null) => (
          <span className="trace-mono">{ms(v)}</span>
        ),
      },
      {
        title: "模型",
        dataIndex: "model",
        key: "model",
        width: 140,
        ellipsis: true,
      },
      {
        title: "模式",
        dataIndex: "chat_mode",
        key: "chat_mode",
        width: 88,
        render: (v: string) => v || "—",
      },
      {
        title: "意图",
        dataIndex: "intent_kind",
        key: "intent_kind",
        width: 120,
      },
      {
        title: "Tools",
        dataIndex: "tools_count",
        key: "tools_count",
        width: 72,
      },
      {
        title: "会话",
        dataIndex: "session_id",
        key: "session_id",
        width: 100,
        ellipsis: true,
        render: (id: string) => id?.slice(0, 8) || "—",
      },
    ],
    [],
  );

  const auditColumns: CabinXColumn<AuditEvent>[] = useMemo(
    () => [
      {
        title: "时间",
        dataIndex: "ts",
        key: "ts",
        width: 168,
        render: (ts: number) => formatTime(ts * 1000),
      },
      {
        title: "裁决",
        dataIndex: "decision",
        key: "decision",
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
        key: "tool_name",
        width: 120,
      },
      {
        title: "域",
        dataIndex: "domain",
        key: "domain",
        width: 100,
      },
      {
        title: "模式",
        dataIndex: "mode_name",
        key: "mode_name",
        width: 100,
        render: (v?: string) => v || "—",
      },
      {
        title: "摘要",
        dataIndex: "input_summary",
        key: "input_summary",
        ellipsis: true,
      },
      {
        title: "会话",
        dataIndex: "session_id",
        key: "session_id",
        width: 100,
        ellipsis: true,
        render: (id: string) => id?.slice(0, 8) || "—",
      },
    ],
    [],
  );

  const drawerTitle = useMemo(() => {
    if (!detail) return "链路详情";
    return (
      <div className="trace-drawer-title">
        <span>链路详情</span>
        {detail.model ? (
          <span className="trace-drawer-title__sub">{detail.model}</span>
        ) : null}
      </div>
    );
  }, [detail]);

  return (
    <PageShell>
      <div className="page">
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: "trace",
              label: "会话链路",
              children: (
                <CabinX
                  api={traceApi}
                  columns={traceColumns}
                  pageTitle="会话链路"
                  rowKey="id"
                  hideTopbar
                  headerActions={null}
                  showActionColumn
                  actionColumnWidth={88}
                  actionColumnRender={(record) => (
                    <ActionOverflow
                      items={[
                        {
                          key: "view",
                          label: "查看",
                          onClick: () => setDetail(record),
                        },
                      ]}
                    />
                  )}
                />
              ),
            },
            {
              key: "audit",
              label: "权限审计",
              children: (
                <CabinX
                  api={auditApi}
                  columns={auditColumns}
                  pageTitle="权限审计"
                  rowKey="id"
                  hideTopbar
                  headerActions={null}
                  showActionColumn={false}
                />
              ),
            },
          ]}
        />
      </div>

      <Drawer
        title={drawerTitle}
        open={!!detail}
        onClose={() => setDetail(null)}
        width={560}
        destroyOnClose
        styles={{ body: { paddingTop: 12 } }}
      >
        {detail ? <TraceDetail detail={detail} /> : null}
      </Drawer>
    </PageShell>
  );
};
