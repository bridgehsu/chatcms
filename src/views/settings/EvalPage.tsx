import { useEffect, useState } from "react";
import { App as AntdApp, Table, Tag } from "antd";
import { PageShell } from "@/layout/components/PageShell";
import { invoke } from "@/hooks/useTauri";

export interface EvalCaseResult {
  id: string;
  input: string;
  expected_kind: string;
  actual_kind: string;
  actual_label: string;
  confidence: number;
  matched: string[];
  passed: boolean;
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  accuracy: number;
  cases: EvalCaseResult[];
}

const KIND_LABEL: Record<string, string> = {
  content_publish: "内容发布",
  account_lookup: "账号查询",
  use_tools: "工具执行",
  general_chat: "闲聊问答",
  unknown: "未识别",
};

const kindLabel = (k: string) => KIND_LABEL[k] ?? k;

const emitEvalState = (busy: boolean, hasReport: boolean) => {
  window.dispatchEvent(
    new CustomEvent("settings-eval:topbar-state", {
      detail: { busy, hasReport },
    }),
  );
};

/** 系统设置 · 意图评测 */
export const EvalPage = () => {
  const { message } = AntdApp.useApp();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<EvalReport | null>(null);

  const run = async () => {
    setBusy(true);
    emitEvalState(true, !!report);
    try {
      const r = await invoke<EvalReport>("intent_eval_run", { cases: null });
      setReport(r);
      message.success(
        `评测完成：${r.passed}/${r.total} 通过（${(r.accuracy * 100).toFixed(0)}%）`,
      );
      emitEvalState(false, true);
    } catch (e) {
      message.error(String(e));
      emitEvalState(false, !!report);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    emitEvalState(busy, !!report);
    const onRun = () => void run();
    const onRequest = () => emitEvalState(busy, !!report);
    window.addEventListener("settings-eval:run", onRun);
    window.addEventListener("settings-eval:topbar-request", onRequest);
    return () => {
      window.removeEventListener("settings-eval:run", onRun);
      window.removeEventListener("settings-eval:topbar-request", onRequest);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bind once + state via emit
  }, [busy, report]);

  return (
    <PageShell>
      <div className="page">
        <div style={{ display: "grid", gap: 16 }}>
          {report && (
            <div
              style={{
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
                padding: "12px 16px",
                borderRadius: 8,
                background: "var(--bg-elevated, var(--bg-muted))",
                border: "1px solid var(--border)",
              }}
            >
              <Stat label="总数" value={String(report.total)} />
              <Stat label="通过" value={String(report.passed)} tone="ok" />
              <Stat
                label="失败"
                value={String(report.failed)}
                tone={report.failed ? "bad" : undefined}
              />
              <Stat
                label="准确率"
                value={`${(report.accuracy * 100).toFixed(0)}%`}
                tone={
                  report.accuracy >= 0.9
                    ? "ok"
                    : report.accuracy >= 0.7
                      ? undefined
                      : "bad"
                }
              />
            </div>
          )}

          <Table<EvalCaseResult>
            rowKey="id"
            size="middle"
            pagination={false}
            dataSource={report?.cases ?? []}
            locale={{ emptyText: "点击右上角「运行评测」开始" }}
            columns={[
              {
                title: "结果",
                dataIndex: "passed",
                width: 80,
                render: (ok: boolean) =>
                  ok ? (
                    <Tag color="success">通过</Tag>
                  ) : (
                    <Tag color="error">失败</Tag>
                  ),
              },
              {
                title: "输入",
                dataIndex: "input",
                ellipsis: true,
              },
              {
                title: "期望",
                dataIndex: "expected_kind",
                width: 110,
                render: (k: string) => kindLabel(k),
              },
              {
                title: "实际",
                dataIndex: "actual_kind",
                width: 110,
                render: (k: string, row) => (
                  <span>
                    {kindLabel(k)}
                    <div
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      conf {(row.confidence * 100).toFixed(0)}%
                    </div>
                  </span>
                ),
              },
              {
                title: "命中词",
                dataIndex: "matched",
                width: 180,
                render: (m: string[]) =>
                  m?.length ? m.map((w) => <Tag key={w}>{w}</Tag>) : "—",
              },
            ]}
          />
        </div>
      </div>
    </PageShell>
  );
};

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) => (
  <div>
    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</div>
    <div
      style={{
        fontSize: 22,
        fontWeight: 600,
        color:
          tone === "ok"
            ? "var(--success, #16a34a)"
            : tone === "bad"
              ? "var(--danger, #dc2626)"
              : "var(--text)",
      }}
    >
      {value}
    </div>
  </div>
);
