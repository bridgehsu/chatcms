import { useMemo } from "react";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import { DeleteOutlined } from "@ant-design/icons";
import { invoke } from "@/hooks/useTauri";
import type { CrawlerTask } from "@/types";
import CabinX, { ActionOverflow, type CabinXColumn } from "@/components/CabinX";
import { IconPlus } from "@/components/icons";
import { formatTime } from "@/utils/time";

const PLATFORM_LABEL: Record<string, string> = {
  xhs: "小红书",
  dy: "抖音",
  ks: "快手",
  bili: "B站",
  wb: "微博",
  tieba: "贴吧",
  zhihu: "知乎",
};

const TYPE_LABEL: Record<string, string> = {
  search: "关键词搜索",
  detail: "指定详情",
  creator: "创作者主页",
};

/** 媒体采集列表 */
export const CrawlerPage = () => {
  const navigate = useNavigate();

  const api = useMemo(
    () => ({
      paging: async (params: any) => {
        let list = await invoke<CrawlerTask[]>("crawler_task_list");
        if (params?.name?.trim()) {
          const q = params.name.trim().toLowerCase();
          list = list.filter((t) =>
            [t.name, t.description, t.keywords, t.platform].join(" ").toLowerCase().includes(q),
          );
        }
        return {
          list,
          total: list.length,
          pageNum: 1,
          pageSize: Math.max(list.length, 10),
        };
      },
      del: async (id: string | number) =>
        invoke("crawler_task_remove", { id: String(id) }),
    }),
    [],
  );

  const columns: CabinXColumn<CrawlerTask>[] = [
    {
      title: "任务",
      dataIndex: "name",
      key: "name",
      search: {
        name: "name",
        label: "关键词",
        type: "input",
        placeholder: "搜索任务名称、关键词…",
      },
      render: (name: string, record: CrawlerTask) => (
        <>
          <span className="model-table__name">{name}</span>
          {record.description ? (
            <div className="account-table__notes">{record.description}</div>
          ) : null}
        </>
      ),
    },
    {
      title: "平台",
      dataIndex: "platform",
      key: "platform",
      render: (v: string) => PLATFORM_LABEL[v] ?? v,
    },
    {
      title: "类型",
      dataIndex: "crawler_type",
      key: "crawler_type",
      render: (v: string) => TYPE_LABEL[v] ?? v,
    },
    {
      title: "关键词 / ID",
      dataIndex: "keywords",
      key: "keywords",
      render: (_: string, record: CrawlerTask) => {
        if (record.crawler_type === "detail") return record.specified_ids || "—";
        if (record.crawler_type === "creator") return record.creator_ids || "—";
        return record.keywords || "—";
      },
    },
    {
      title: "存储",
      dataIndex: "save_option",
      key: "save_option",
      render: (v: string) => (v || "jsonl").toUpperCase(),
    },
    {
      title: "更新",
      dataIndex: "updated",
      key: "updated",
      render: (ms: number) => formatTime(ms),
    },
  ];

  return (
    <div className="page page-scroll">
      <CabinX
        api={api}
        columns={columns}
        pageTitle="媒体采集"
        rowKey="id"
        showActionColumn
        headerActions={
          <Button
            variant="outlined"
            color="primary"
            icon={<IconPlus />}
            onClick={() => navigate("/crawler/new")}
          >
            新增
          </Button>
        }
        actionColumnRender={(record, actions) => (
          <ActionOverflow
            items={[
              {
                key: "open",
                label: "打开配置",
                onClick: () => navigate(`/crawler/${record.id}`),
              },
              {
                key: "delete",
                label: "删除",
                icon: <DeleteOutlined />,
                danger: true,
                onClick: () => {
                  if (!window.confirm(`确定删除任务「${record.name}」？`)) return;
                  void actions.handleDelete(record.id);
                },
              },
            ]}
          />
        )}
      />
    </div>
  );
};

export { CrawlerConfigPage } from "./CrawlerConfigPage";
