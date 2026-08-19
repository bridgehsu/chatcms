import { useMemo, useState } from 'react';
import { App as AntdApp, Button, Form, Input, InputNumber, Select, Switch, Tag } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { invoke } from '@/hooks/useTauri';
import CabinX, { type CabinXColumn } from '@/components/CabinX';

const LOCAL_BASE_URL = 'http://localhost:11434';

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
    capabilities: Record<string, boolean>;
    thinking: boolean;
    thinking_effort: string;
    temperature: number | null;
    max_output_tokens: number | null;
    extra_body: Record<string, unknown>;
    tags: string[];
}

// ── 常量 ─────────────────────────────────────────────────────────────────────

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

const EFFORT_OPTIONS = [
    { label: '低 (Low) — 约 1k tokens', value: 'low' },
    { label: '中 (Medium) — 约 8k tokens', value: 'medium' },
    { label: '高 (High) — 约 16k tokens', value: 'high' },
];

const PRESET_TAGS = [
    { label: 'reasoning', value: 'reasoning' },
    { label: 'coding', value: 'coding' },
    { label: 'vision', value: 'vision' },
    { label: 'fast', value: 'fast' },
    { label: 'large-context', value: 'large-context' },
];

// ── 动态子组件（内部使用 Form.useWatch） ──────────────────────────────────────

/** 思考深度选择器：仅在 thinking=true 时可用 */
const ThinkingEffortField = ({ form }: { form: any }) => {
    const thinking = Form.useWatch('thinking', form);
    return (
        <Form.Item name="thinkingEffort" noStyle initialValue="medium">
            <Select
                options={EFFORT_OPTIONS}
                disabled={!thinking}
                placeholder="开启后选择深度"
            />
        </Form.Item>
    );
};

/** extra_body JSON 文本域 */
const ExtraBodyField = () => (
    <Form.Item name="extraBody" noStyle>
        <Input.TextArea
            rows={3}
            placeholder={'{\n  "think": true\n}'}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
    </Form.Item>
);

// ── 主页面 ────────────────────────────────────────────────────────────────────

export const ModelsPage = () => {
    const { message } = AntdApp.useApp();
    const [refreshKey, setRefreshKey] = useState(0);

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
            list = [...list].sort((a, b) => {
                if (a.tier !== b.tier) return a.tier === 'cloud' ? -1 : 1;
                return b.weight - a.weight;
            });
            return { list, total: list.length, pageNum: 1, pageSize: Math.max(list.length, 10) };
        },
        add:  async (data: any) => invoke('model_profile_add', data),
        edit: async (data: any) => invoke('model_profile_update', data),
        del:  async (id: string | number) => invoke('model_profile_remove', { id: String(id) }),
    }), [refreshKey]);

    // 记录 → 表单初始值（snake_case → camelCase）
    const updateProfile = async (record: ProviderProfile, patch: Partial<ProviderProfile>) => {
        const p = { ...record, ...patch };
        await invoke('model_profile_update', {
            id:              p.id,
            name:            p.name,
            kind:            p.kind,
            apiKey:          p.api_key,
            model:           p.model,
            baseUrl:         p.base_url ?? null,
            tier:            p.tier,
            weight:          p.weight,
            contextWindow:   p.context_window,
            enabled:         p.enabled,
            capabilities:    p.capabilities ?? null,
            thinking:        p.thinking,
            thinkingEffort:  p.thinking_effort,
            temperature:     p.temperature ?? null,
            maxOutputTokens: p.max_output_tokens ?? null,
            extraBody:       p.extra_body ?? null,
            tags:            p.tags ?? [],
        });
        setRefreshKey(k => k + 1);
    };

    const formatRecordForEdit = (record: ProviderProfile) => ({
        id:               record.id,
        name:             record.name,
        tier:             record.tier,
        kind:             record.kind,
        apiKey:           record.api_key,
        model:            record.model,
        baseUrl:          record.base_url ?? '',
        weight:           record.weight,
        contextWindow:    record.context_window,
        enabled:          record.enabled,
        tags:             record.tags ?? [],
        capReasoning:     record.capabilities?.reasoning ?? false,
        capVision:        record.capabilities?.vision    ?? false,
        thinking:         record.thinking ?? false,
        thinkingEffort:   record.thinking_effort ?? 'medium',
        temperature:      record.temperature ?? null,
        maxOutputTokens:  record.max_output_tokens ?? null,
        extraBody:
            record.extra_body && Object.keys(record.extra_body).length > 0
                ? JSON.stringify(record.extra_body, null, 2)
                : '',
    });

    // 表单值 → 提交给后端（camelCase 字段名，Tauri 自动转 snake_case）
    const beforeSubmit = (values: any) => {
        const capabilities: Record<string, boolean> = {};
        if (values.capReasoning) capabilities.reasoning = true;
        if (values.capVision)    capabilities.vision    = true;

        let extraBody: Record<string, unknown> | null = null;
        if (values.extraBody?.trim()) {
            try { extraBody = JSON.parse(values.extraBody); } catch { /* 忽略非法 JSON */ }
        }

        const out: Record<string, any> = {
            name:            values.name?.trim(),
            kind:            values.kind,
            apiKey:          values.apiKey ?? '',
            model:           values.model?.trim(),
            baseUrl:         values.baseUrl?.trim() || null,
            tier:            values.tier,
            weight:          values.weight ?? 2,
            contextWindow:   values.contextWindow ?? 8192,
            enabled:         values.enabled ?? true,
            tags:            values.tags ?? [],
            capabilities:    Object.keys(capabilities).length > 0 ? capabilities : null,
            thinking:        values.thinking ?? false,
            thinkingEffort:  values.thinkingEffort ?? 'medium',
            temperature:     typeof values.temperature === 'number' ? values.temperature : null,
            maxOutputTokens: typeof values.maxOutputTokens === 'number' ? values.maxOutputTokens : null,
            extraBody:       extraBody,
        };
        if (values.id) out.id = values.id;
        return out;
    };

    const copyProfile = async (record: ProviderProfile) => {
        try {
            // 创建副本（add 默认 enabled=true）
            const copy = await invoke<ProviderProfile>('model_profile_add', {
                name:            `${record.name} (副本)`,
                kind:            record.kind,
                apiKey:          record.api_key,
                model:           record.model,
                baseUrl:         record.base_url ?? null,
                tier:            record.tier,
                weight:          record.weight,
                contextWindow:   record.context_window,
                capabilities:    record.capabilities ?? null,
                thinking:        record.thinking,
                thinkingEffort:  record.thinking_effort,
                temperature:     record.temperature ?? null,
                maxOutputTokens: record.max_output_tokens ?? null,
                extraBody:       record.extra_body ?? null,
                tags:            record.tags ?? [],
            });
            // 将副本设为停用
            await invoke('model_profile_update', {
                id:              copy.id,
                name:            copy.name,
                kind:            copy.kind,
                apiKey:          copy.api_key,
                model:           copy.model,
                baseUrl:         copy.base_url ?? null,
                tier:            copy.tier,
                weight:          copy.weight,
                contextWindow:   copy.context_window,
                enabled:         false,
                capabilities:    copy.capabilities ?? null,
                thinking:        copy.thinking,
                thinkingEffort:  copy.thinking_effort,
                temperature:     copy.temperature ?? null,
                maxOutputTokens: copy.max_output_tokens ?? null,
                extraBody:       copy.extra_body ?? null,
                tags:            copy.tags ?? [],
            });
            message.success('复制成功');
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            message.error(err?.message || '复制失败');
        }
    };

    const columns: CabinXColumn<ProviderProfile>[] = [
        // ── 表格 + 表单字段 ──────────────────────────────────────────────────
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
            render: (name: string) => (
                <span className="model-table__name">{name}</span>
            ),
        },
        {
            title: '模型 ID',
            dataIndex: 'model',
            key: 'model',
            render: (model: string) => (
                <span className="model-table__mono">{model}</span>
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
                                form.setFieldsValue({ kind: 'openai', baseUrl: LOCAL_BASE_URL });
                            }
                        }}
                    />
                ),
            },
            render: (tier: string) => (
                <Tag color={tier === 'cloud' ? 'blue' : 'orange'}>
                    {tier === 'cloud' ? '云端' : '本地'}
                </Tag>
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
                    { label: 'openai',    value: 'openai' },
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
            title: 'Context',
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
                <span className="model-table__mono model-table__url">{url || '默认'}</span>
            ),
        },
        {
            title: '标签',
            dataIndex: 'tags',
            key: 'tags',
            render: (tags: string[]) => (
                <>
                    {(tags ?? []).map(t => (
                        <Tag key={t} style={{ marginBottom: 2 }}>{t}</Tag>
                    ))}
                </>
            ),
        },
        {
            title: '状态',
            dataIndex: 'enabled',
            key: 'enabled',
            render: (enabled: boolean, record: ProviderProfile) => (
                <Switch
                    size="small"
                    checked={enabled}
                    onChange={() => void updateProfile(record, { enabled: !record.enabled })}
                />
            ),
        },

        // ── 纯表单字段（hideInTable）─────────────────────────────────────────
        {
            title: '__id',
            dataIndex: '__id',
            key: '__id',
            hideInTable: true,
            editor: {
                name: 'id',
                label: 'id',
                type: 'input',
                hide: [true, true, true],
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
                placeholder: 'claude-sonnet-4-6 / qwen3:14b',
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
                placeholder: '留空使用默认（如 http://localhost:11434）',
            },
        },
        {
            title: 'Context / 最大输出（表单）',
            dataIndex: '__tokenLimits',
            key: '__tokenLimits',
            hideInTable: true,
            editor: {
                name: 'contextWindow',
                label: 'Token 限制',
                type: 'input',
                initialValue: 8192,
                renderFormItem: () => (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Context 窗口</div>
                            <Form.Item name="contextWindow" noStyle initialValue={8192}>
                                <InputNumber
                                    min={1024}
                                    step={1024}
                                    style={{ width: '100%' }}
                                    addonAfter="tokens"
                                />
                            </Form.Item>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>最大输出</div>
                            <Form.Item name="maxOutputTokens" noStyle>
                                <InputNumber
                                    min={256}
                                    step={1024}
                                    style={{ width: '100%' }}
                                    placeholder="默认"
                                    addonAfter="tokens"
                                />
                            </Form.Item>
                        </div>
                    </div>
                ),
            },
        },
        {
            title: '温度',
            dataIndex: '__temperature',
            key: '__temperature',
            hideInTable: true,
            editor: {
                name: 'temperature',
                label: '采样温度',
                type: 'input',
                renderFormItem: () => (
                    <Form.Item name="temperature" noStyle>
                        <InputNumber
                            min={0}
                            max={2}
                            step={0.1}
                            precision={1}
                            style={{ width: '100%' }}
                            placeholder="留空使用模型默认"
                        />
                    </Form.Item>
                ),
            },
        },

        // ── 思考模式 ─────────────────────────────────────────────────────────
        {
            title: '思考模式（表单）',
            dataIndex: '__thinking',
            key: '__thinking',
            hideInTable: true,
            editor: {
                name: 'thinking',
                label: '思考模式',
                type: 'switch',
                initialValue: false,
                renderFormItem: (form: any) => (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Form.Item name="thinking" noStyle valuePropName="checked" initialValue={false}>
                            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                        </Form.Item>
                        <div style={{ flex: 1 }}>
                            <ThinkingEffortField form={form} />
                        </div>
                    </div>
                ),
            },
        },

        // ── 能力声明 ─────────────────────────────────────────────────────────
        {
            title: '能力（表单）',
            dataIndex: '__capabilities',
            key: '__capabilities',
            hideInTable: true,
            editor: {
                name: 'capReasoning',
                label: '能力',
                type: 'switch',
                initialValue: false,
                renderFormItem: () => (
                    <div style={{ display: 'flex', gap: 24 }}>
                        <div>
                            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>推理 (Reasoning)</div>
                            <Form.Item name="capReasoning" noStyle valuePropName="checked" initialValue={false}>
                                <Switch checkedChildren="支持" unCheckedChildren="不支持" />
                            </Form.Item>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>视觉 (Vision)</div>
                            <Form.Item name="capVision" noStyle valuePropName="checked" initialValue={false}>
                                <Switch checkedChildren="支持" unCheckedChildren="不支持" />
                            </Form.Item>
                        </div>
                    </div>
                ),
            },
        },

        // ── 路由标签 ─────────────────────────────────────────────────────────
        {
            title: '标签（表单）',
            dataIndex: '__tags',
            key: '__tags',
            hideInTable: true,
            editor: {
                name: 'tags',
                label: '路由标签',
                type: 'select',
                renderFormItem: () => (
                    <Form.Item name="tags" noStyle>
                        <Select
                            mode="tags"
                            options={PRESET_TAGS}
                            placeholder="选择或输入自定义标签，回车确认"
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                ),
            },
        },

        // ── 额外参数 ─────────────────────────────────────────────────────────
        {
            title: '额外参数',
            dataIndex: '__extraBody',
            key: '__extraBody',
            hideInTable: true,
            editor: {
                name: 'extraBody',
                label: '额外请求参数 (JSON)',
                type: 'input',
                renderFormItem: () => <ExtraBodyField />,
            },
        },

        // ── 启用 ─────────────────────────────────────────────────────────────
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
                hide: [true, false, false],
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
                editorWidth={560}
                initialSearchValues={{ tier: 'all' }}
                actionBtnComponents={(record: ProviderProfile) => (
                    <Button
                        type="link"
                        icon={<CopyOutlined />}
                        onClick={() => void copyProfile(record)}
                    >
                        复制
                    </Button>
                )}
            />
        </div>
    );
};
