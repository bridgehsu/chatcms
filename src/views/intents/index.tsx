import { useMemo, useState } from 'react';
import { App as AntdApp, Button, Input, InputNumber, Select, Space, Switch, Tag } from 'antd';
import { EditOutlined, RedoOutlined } from '@ant-design/icons';
import { invoke } from '@/hooks/useTauri';
import CabinX, { type CabinXColumn } from '@/components/CabinX';
import { formatTime } from '@/utils/time';

export interface IntentRule {
    id: string;
    kind: string;
    label: string;
    keywords: string[];
    weight: number;
    enabled: boolean;
    sort_order: number;
    updated: number;
}

const KIND_OPTIONS = [
    { label: '全部', value: 'all' },
    { label: '内容发布', value: 'content_publish' },
    { label: '账号查询', value: 'account_lookup' },
    { label: '工具执行', value: 'use_tools' },
    { label: '闲聊问答', value: 'general_chat' },
];

export const IntentsPage = () => {
    const { message, modal } = AntdApp.useApp();
    const [refreshKey, setRefreshKey] = useState(0);

    const api = useMemo(() => ({
        paging: async (params: any) => {
            void refreshKey;
            let list = await invoke<IntentRule[]>('intent_rule_list');
            if (params?.kind && params.kind !== 'all') {
                list = list.filter(r => r.kind === params.kind);
            }
            if (params?.keyword?.trim()) {
                const q = params.keyword.trim().toLowerCase();
                list = list.filter(r =>
                    [r.label, r.kind, ...(r.keywords ?? [])].join(' ').toLowerCase().includes(q),
                );
            }
            return { list, total: list.length, pageNum: 1, pageSize: Math.max(list.length, 10) };
        },
        edit: async (data: any) => {
            const { id, keywords, weight, enabled } = data;
            return invoke('intent_rule_update', {
                id,
                keywords,
                weight,
                enabled,
            });
        },
    }), [refreshKey]);

    const formatRecordForEdit = (record: IntentRule) => ({
        label: `${record.label}（${record.kind}）`,
        keywords: record.keywords ?? [],
        weight: record.weight,
        enabled: record.enabled,
    });

    const beforeSubmit = (values: any) => ({
        keywords: values.keywords ?? [],
        weight: Number(values.weight),
        enabled: values.enabled ?? true,
    });

    const resetOne = (record: IntentRule) => {
        modal.confirm({
            title: '恢复默认',
            content: `将「${record.label}」的关键词与权重恢复为内置默认？`,
            okText: '恢复',
            cancelText: '取消',
            onOk: async () => {
                await invoke('intent_rule_reset_one', { id: record.id });
                message.success('已恢复默认');
                setRefreshKey(k => k + 1);
            },
        });
    };

    const resetAll = () => {
        modal.confirm({
            title: '全部恢复默认',
            content: '将所有意图规则恢复为内置关键词与权重，当前自定义会被覆盖。',
            okText: '全部恢复',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
                await invoke('intent_rule_reset_defaults');
                message.success('已全部恢复默认');
                setRefreshKey(k => k + 1);
            },
        });
    };

    const columns: CabinXColumn<IntentRule>[] = [
        {
            title: '意图',
            dataIndex: 'label',
            key: 'label',
            search: {
                name: 'kind',
                label: '意图',
                type: 'select',
                options: KIND_OPTIONS,
                placeholder: '全部意图',
            },
            editor: {
                name: 'label',
                label: '意图',
                type: 'input',
                renderFormItem: () => <Input disabled />,
            },
            render: (label: string, record: IntentRule) => (
                <>
                    <span>{label}</span>
                    <div className="account-table__notes">{record.kind}</div>
                </>
            ),
        },
        {
            title: '关键词',
            dataIndex: 'keywords',
            key: 'keywords',
            search: {
                name: 'keyword',
                label: '关键词',
                type: 'input',
                placeholder: '搜索意图或关键词…',
            },
            editor: {
                name: 'keywords',
                label: '关键词',
                type: 'select',
                rules: [{ required: true, message: '请至少保留一个关键词' }],
                renderFormItem: () => (
                    <Select
                        mode="tags"
                        tokenSeparators={[',', '，']}
                        placeholder="输入后回车添加"
                        style={{ width: '100%' }}
                    />
                ),
            },
            render: (keywords: string[]) => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 420 }}>
                    {(keywords ?? []).slice(0, 12).map(k => (
                        <Tag key={k} style={{ marginInlineEnd: 0 }}>{k}</Tag>
                    ))}
                    {(keywords ?? []).length > 12 && (
                        <Tag style={{ marginInlineEnd: 0 }}>+{(keywords ?? []).length - 12}</Tag>
                    )}
                </div>
            ),
        },
        {
            title: '权重',
            dataIndex: 'weight',
            key: 'weight',
            width: 100,
            editor: {
                name: 'weight',
                label: '单次命中权重（0.01–1.0）',
                type: 'input',
                rules: [{ required: true, message: '请输入权重' }],
                renderFormItem: () => (
                    <InputNumber min={0.01} max={1} step={0.01} style={{ width: '100%' }} />
                ),
            },
            render: (w: number) => <span className="model-table__mono">{Number(w).toFixed(2)}</span>,
        },
        {
            title: '启用',
            dataIndex: 'enabled',
            key: 'enabled',
            width: 90,
            editor: {
                name: 'enabled',
                label: '启用',
                type: 'switch',
                valuePropName: 'checked',
                initialValue: true,
            },
            render: (enabled: boolean, record: IntentRule) => (
                <Switch
                    size="small"
                    checked={enabled}
                    onChange={async (checked) => {
                        await invoke('intent_rule_update', {
                            id: record.id,
                            keywords: record.keywords,
                            weight: record.weight,
                            enabled: checked,
                        });
                        setRefreshKey(k => k + 1);
                    }}
                />
            ),
        },
        {
            title: '更新',
            dataIndex: 'updated',
            key: 'updated',
            width: 160,
            render: (ms: number) => formatTime(ms),
        },
    ];

    return (
        <div className="page page-scroll">
            <CabinX
                api={api}
                columns={columns}
                pageTitle="意图规则"
                rowKey="id"
                headerActions={null}
                formatRecordForEdit={formatRecordForEdit}
                beforeSubmit={beforeSubmit}
                formType="D"
                editorWidth={520}
                extraHeaderActions={
                    <Button onClick={resetAll}>全部恢复默认</Button>
                }
                actionColumnRender={(record, actions) => (
                    <Space size={2}>
                        <Button type="link" icon={<EditOutlined />} onClick={() => actions.handleEdit(record)}>
                            编辑
                        </Button>
                        <Button type="link" icon={<RedoOutlined />} onClick={() => resetOne(record)}>
                            恢复默认
                        </Button>
                    </Space>
                )}
            />
        </div>
    );
};
