import { useMemo, useState } from 'react';
import { Form, InputNumber, Select } from 'antd';
import { invoke } from '@/hooks/useTauri';
import CabinX, { type CabinXColumn } from '@/components/CabinX';

const LOCAL_BASE_URL = 'http://localhost:11434/v1';

export interface ProviderProfile {
    id: string;
    name: string;
    kind: string;
    api_key: string;
    model: string;
    base_url?: string | null;
    tier: string;
    weight: number;
    context_window: number;
    enabled: boolean;
    created: number;
    updated: number;
}

const TIER_OPTIONS = [
    { label: '全部', value: 'all' },
    { label: '云端', value: 'cloud' },
    { label: '本地', value: 'local' },
];

const WEIGHT_OPTIONS = [
    { label: '1 - 兜底', value: 1 },
    { label: '2 - 普通', value: 2 },
    { label: '3 - 优先', value: 3 },
    { label: '4 - 最高', value: 4 },
];

export const ModelsPage = () => {
    const [refreshKey] = useState(0);

    const api = useMemo(() => ({
        paging: async (params: any) => {
            void refreshKey;
            let list = await invoke<ProviderProfile[]>('model_profile_list');
            if (params?.tier && params.tier !== 'all') {
                list = list.filter(p => p.tier === params.tier);
            }
            if (params?.name?.trim()) {
                const q = params.name.trim().toLowerCase();
                list = list.filter(p =>
                    [p.name, p.model].join(' ').toLowerCase().includes(q),
                );
            }
            // 排序：cloud 在前，local 在后；同 tier 内 weight 降序
            list = [...list].sort((a, b) => {
                if (a.tier !== b.tier) {
                    return a.tier === 'cloud' ? -1 : 1;
                }
                return b.weight - a.weight;
            });
            return { list, total: list.length, pageNum: 1, pageSize: Math.max(list.length, 10) };
        },
        add: async (data: any) => invoke('model_profile_add', data),
        edit: async (data: any) => invoke('model_profile_update', data),
        del: async (id: string | number) => invoke('model_profile_remove', { id: String(id) }),
    }), [refreshKey]);

    const formatRecordForEdit = (record: ProviderProfile) => ({
        id: record.id,
        name: record.name,
        tier: record.tier,
        kind: record.kind,
        apiKey: record.api_key,
        model: record.model,
        baseUrl: record.base_url ?? '',
        weight: record.weight,
        contextWindow: record.context_window,
        enabled: record.enabled,
    });

    const beforeSubmit = (values: any) => {
        const out: Record<string, any> = {
            name: values.name?.trim(),
            kind: values.kind,
            apiKey: values.apiKey ?? '',
            model: values.model?.trim(),
            baseUrl: values.baseUrl?.trim() || null,
            tier: values.tier,
            weight: values.weight ?? 2,
            contextWindow: values.contextWindow ?? 8192,
            enabled: values.enabled ?? true,
        };
        // edit 模式需要 id
        if (values.id) {
            out.id = values.id;
        }
        return out;
    };

    const columns: CabinXColumn<ProviderProfile>[] = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            search: {
                name: 'name',
                label: '关键词',
                type: 'input',
                placeholder: '搜索名称、模型 ID…',
            },
            editor: {
                name: 'name',
                label: '名称',
                type: 'input',
                rules: [{ required: true, message: '请输入名称' }],
                placeholder: '例如：公司 Claude / 本地 Qwen',
            },
            render: (name: string, record: ProviderProfile) => (
                <>
                    <span className="model-table__name">{name}</span>
                    <div className="account-table__notes model-table__mono">{record.model}</div>
                </>
            ),
        },
        {
            title: '类型',
            dataIndex: 'tier',
            key: 'tier',
            search: {
                name: 'tier',
                label: '类型',
                type: 'select',
                options: TIER_OPTIONS,
                placeholder: '全部',
            },
            editor: {
                name: 'tier',
                label: '类型',
                type: 'select',
                options: [
                    { label: '云端 (cloud)', value: 'cloud' },
                    { label: '本地 (local)', value: 'local' },
                ],
                rules: [{ required: true, message: '请选择类型' }],
                initialValue: 'cloud',
                renderFormItem: (form: any) => (
                    <Select
                        options={[
                            { label: '云端 (cloud)', value: 'cloud' },
                            { label: '本地 (local)', value: 'local' },
                        ]}
                        onChange={(val: string) => {
                            if (val === 'local') {
                                form.setFieldsValue({
                                    kind: 'openai',
                                    baseUrl: LOCAL_BASE_URL,
                                });
                            }
                        }}
                    />
                ),
            },
            render: (tier: string) => (
                <span className={`model-badge${tier === 'local' ? ' model-badge--disabled' : ''}`}>
                    {tier === 'cloud' ? '云端' : '本地'}
                </span>
            ),
        },
        {
            title: '协议',
            dataIndex: 'kind',
            key: 'kind',
            editor: {
                name: 'kind',
                label: '协议',
                type: 'select',
                options: [
                    { label: 'anthropic', value: 'anthropic' },
                    { label: 'openai', value: 'openai' },
                ],
                rules: [{ required: true, message: '请选择协议' }],
                initialValue: 'anthropic',
            },
            render: (kind: string) => (
                <span className="model-table__mono">{kind}</span>
            ),
        },
        {
            title: '权重',
            dataIndex: 'weight',
            key: 'weight',
            editor: {
                name: 'weight',
                label: '权重',
                type: 'select',
                options: WEIGHT_OPTIONS,
                initialValue: 2,
            },
            render: (weight: number) => (
                <span className="model-table__mono">{weight}</span>
            ),
        },
        {
            title: 'Context 窗口',
            dataIndex: 'context_window',
            key: 'context_window',
            render: (ctx: number) => (
                <span className="model-table__mono">{ctx.toLocaleString()}</span>
            ),
        },
        {
            title: '接口地址',
            dataIndex: 'base_url',
            key: 'base_url',
            render: (url: string | null | undefined) => (
                <span className="model-table__mono model-table__url">
                    {url || '默认'}
                </span>
            ),
        },
        {
            title: '状态',
            dataIndex: 'enabled',
            key: 'enabled',
            render: (enabled: boolean) =>
                enabled
                    ? <span className="model-badge">启用</span>
                    : <span className="model-status-idle">停用</span>,
        },
        // ── Form-only fields (hideInTable) ────────────────────────────────
        {
            title: '__id',
            dataIndex: '__id',
            key: '__id',
            hideInTable: true,
            editor: {
                name: 'id',
                label: 'id',
                type: 'input',
                hide: [true, true, true], // 永远不在 UI 中展示，仅作隐藏字段传值
            },
        },
        {
            title: 'API 密钥',
            dataIndex: '__apiKey',
            key: '__apiKey',
            hideInTable: true,
            editor: {
                name: 'apiKey',
                label: 'API 密钥',
                type: 'input',
                placeholder: 'sk-...',
            },
        },
        {
            title: '模型 ID',
            dataIndex: '__model',
            key: '__model',
            hideInTable: true,
            editor: {
                name: 'model',
                label: '模型 ID',
                type: 'input',
                rules: [{ required: true, message: '请输入模型 ID' }],
                placeholder: 'claude-sonnet-4-6 / qwen2.5:14b',
            },
        },
        {
            title: '接口地址（表单）',
            dataIndex: '__baseUrl',
            key: '__baseUrl',
            hideInTable: true,
            editor: {
                name: 'baseUrl',
                label: '接口地址',
                type: 'input',
                placeholder: '留空使用默认',
            },
        },
        {
            title: 'Context 窗口（表单）',
            dataIndex: '__contextWindow',
            key: '__contextWindow',
            hideInTable: true,
            editor: {
                name: 'contextWindow',
                label: 'Context 窗口',
                type: 'input',
                initialValue: 8192,
                renderFormItem: (_form: any) => (
                    <Form.Item name="contextWindow" noStyle initialValue={8192}>
                        <InputNumber min={1024} step={1024} style={{ width: '100%' }} />
                    </Form.Item>
                ),
            },
        },
        {
            title: '启用（表单）',
            dataIndex: '__enabled_form',
            key: '__enabled_form',
            hideInTable: true,
            editor: {
                name: 'enabled',
                label: '启用',
                type: 'switch',
                valuePropName: 'checked',
                initialValue: true,
                checkedChildren: '启用',
                unCheckedChildren: '停用',
                hide: [true, false, false], // 新增时隐藏，编辑时显示
            },
        },
    ];

    return (
        <div className="page page-scroll">
            <CabinX
                api={api}
                columns={columns}
                pageTitle="模型配置"
                rowKey="id"
                formatRecordForEdit={formatRecordForEdit}
                beforeSubmit={beforeSubmit}
                formType="D"
                editorWidth={520}
                initialSearchValues={{ tier: 'all' }}
            />
        </div>
    );
};
