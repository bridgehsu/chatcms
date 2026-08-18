import { useMemo, useState } from 'react';
import { Button, Form, Select } from 'antd';
import { invoke } from '@/hooks/useTauri';
import type { McpServerInfo } from '@/types';
import CabinX, { type CabinXColumn } from '@/components/CabinX';
import { MCP_PRESETS } from '@/config/mcpPresets';
import { McpToolsModal } from './components/McpToolsModal';

const parseArgs = (raw: string) =>
    raw.split(/\s+/).map(s => s.trim()).filter(Boolean);

const parseEnv = (raw: string) => {
    const env: Record<string, string> = {};
    for (const line of raw.split('\n')) {
        const [k, ...rest] = line.split('=');
        if (k?.trim()) env[k.trim()] = rest.join('=').trim();
    }
    return env;
};

const statusText = (s: McpServerInfo['status']) => {
    if (s.state === 'connected') return `已连接 · ${(s as any).tools} 工具`;
    if (s.state === 'error') return '错误';
    return '未连接';
};

const PRESET_OPTIONS = [
    { value: '', label: '自定义 / 不使用预设' },
    ...MCP_PRESETS.map(p => ({ value: p.id, label: p.label })),
];

export const McpPage = () => {
    const [refreshKey, setRefreshKey] = useState(0);
    const [toolsFor, setToolsFor] = useState<string | null>(null);

    const api = useMemo(() => ({
        paging: async (params: any) => {
            void refreshKey;
            let list = await invoke<McpServerInfo[]>('mcp_list');
            if (params?.status && params.status !== 'all') {
                list = list.filter(s => s.status.state === params.status);
            }
            if (params?.name?.trim()) {
                const q = params.name.trim().toLowerCase();
                list = list.filter(s => {
                    const cmd = `${s.config.command} ${(s.config.args ?? []).join(' ')}`;
                    return [s.name, s.config.description ?? '', cmd].join(' ').toLowerCase().includes(q);
                });
            }
            return { list, total: list.length, pageNum: 1, pageSize: Math.max(list.length, 10) };
        },
        add: async (data: any) => invoke('mcp_add', data),
        edit: async (data: any) => {
            const { id: name, ...rest } = data;
            return invoke('mcp_update', { name, ...rest });
        },
        del: async (name: string | number) => invoke('mcp_remove', { name: String(name) }),
    }), [refreshKey]);

    const formatRecordForEdit = (record: McpServerInfo) => {
        const envLines = Object.entries(record.config.env ?? {})
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
        return {
            name: record.name,
            command: record.config.command,
            args: (record.config.args ?? []).join(' '),
            env: envLines,
            cwd: record.config.cwd ?? '',
            description: record.config.description ?? '',
            enabled: record.config.enabled !== false,
        };
    };

    const beforeSubmit = (values: any) => {
        const { _preset, ...rest } = values;
        return {
            name: rest.name?.trim(),
            command: rest.command?.trim(),
            args: parseArgs(rest.args ?? ''),
            env: parseEnv(rest.env ?? ''),
            cwd: rest.cwd?.trim() || null,
            description: rest.description?.trim() || '',
            enabled: rest.enabled ?? true,
        };
    };

    const columns: CabinXColumn<McpServerInfo>[] = [
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            search: {
                name: 'status',
                label: '状态',
                type: 'select',
                options: [
                    { label: '全部状态', value: 'all' },
                    { label: '已连接', value: 'connected' },
                    { label: '未连接', value: 'disconnected' },
                    { label: '错误', value: 'error' },
                ],
                placeholder: '全部状态',
            },
            render: (status: McpServerInfo['status']) => {
                const cls = status.state === 'connected'
                    ? 'mcp-badge mcp-badge--ok'
                    : status.state === 'error'
                        ? 'mcp-badge mcp-badge--err'
                        : 'mcp-badge';
                return (
                    <>
                        <span className={cls}>{statusText(status)}</span>
                        {status.state === 'error' && (
                            <div className="account-table__notes mcp-error-msg">
                                {(status as any).message}
                            </div>
                        )}
                    </>
                );
            },
        },
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            search: { name: 'name', label: '关键词', type: 'input', placeholder: '搜索名称、命令、说明…' },
            editor: {
                name: 'name',
                label: '名称',
                type: 'input',
                rules: [{ required: true, message: '请输入名称' }],
                placeholder: 'filesystem',
            },
            render: (name: string, record: McpServerInfo) => (
                <>
                    <span className="model-table__name">{name}</span>
                    {record.config.description && (
                        <div className="account-table__notes">{record.config.description}</div>
                    )}
                </>
            ),
        },
        {
            title: '命令/参数',
            dataIndex: 'config',
            key: 'config_display',
            render: (config: McpServerInfo['config']) => (
                <span className="model-table__mono model-table__url">
                    {config.command} {(config.args ?? []).join(' ')}
                </span>
            ),
        },
        // Form-only fields (hideInTable)
        {
            title: '预设',
            dataIndex: '__preset',
            key: '__preset',
            hideInTable: true,
            editor: {
                name: '_preset',
                label: '预设（新增时可选）',
                type: 'input',
                hide: [false, true, true],
                renderFormItem: (form: any) => (
                    <Select
                        options={PRESET_OPTIONS}
                        placeholder="选择预设快速填充"
                        allowClear
                        onChange={(id: string) => {
                            if (!id) return;
                            const p = MCP_PRESETS.find(x => x.id === id);
                            if (!p) return;
                            form.setFieldsValue({
                                name: p.name,
                                command: p.command,
                                args: p.args,
                                env: p.env ?? '',
                                cwd: p.cwd ?? '',
                                description: p.description,
                                enabled: true,
                            });
                        }}
                    />
                ),
            },
        },
        {
            title: '命令',
            dataIndex: '__command',
            key: '__command',
            hideInTable: true,
            editor: {
                name: 'command',
                label: '命令',
                type: 'input',
                rules: [{ required: true, message: '请输入命令' }],
                placeholder: 'npx / uvx / node',
                initialValue: 'npx',
            },
        },
        {
            title: '参数',
            dataIndex: '__args',
            key: '__args',
            hideInTable: true,
            editor: {
                name: 'args',
                label: '参数（空格分隔）',
                type: 'input',
                placeholder: '-y @modelcontextprotocol/server-filesystem /tmp',
            },
        },
        {
            title: '说明',
            dataIndex: '__description',
            key: '__description',
            hideInTable: true,
            editor: {
                name: 'description',
                label: '说明',
                type: 'input',
                placeholder: '用途简述',
            },
        },
        {
            title: '工作目录',
            dataIndex: '__cwd',
            key: '__cwd',
            hideInTable: true,
            editor: {
                name: 'cwd',
                label: '工作目录（可选）',
                type: 'input',
                placeholder: '/path/to/workdir',
            },
        },
        {
            title: '环境变量',
            dataIndex: '__env',
            key: '__env',
            hideInTable: true,
            editor: {
                name: 'env',
                label: '环境变量（每行 KEY=VALUE）',
                type: 'textarea',
                rows: 4,
                placeholder: 'API_KEY=xxx\nGITHUB_TOKEN=',
            },
        },
        {
            title: '启用',
            dataIndex: '__enabled_form',
            key: '__enabled_form',
            hideInTable: true,
            editor: {
                name: 'enabled',
                label: '启用并连接',
                type: 'switch',
                valuePropName: 'checked',
                initialValue: true,
                checkedChildren: '启用',
                unCheckedChildren: '停用',
            },
        },
        {
            title: '启用',
            dataIndex: 'config',
            key: 'enabled_display',
            render: (config: McpServerInfo['config']) =>
                config.enabled !== false
                    ? <span className="model-badge">启用</span>
                    : <span className="model-status-idle">停用</span>,
        },
    ];

    return (
        <div className="page page-scroll">
            <CabinX
                api={api}
                columns={columns}
                pageTitle="模型协议（MCP）"
                rowKey="name"
                formatRecordForEdit={formatRecordForEdit}
                beforeSubmit={beforeSubmit}
                formType="D"
                editorWidth={560}
                filterEditorFields={(fields, currentItem) => {
                    if (!currentItem) return fields;
                    // 编辑模式：名称只读
                    return fields.map(f =>
                        f.name === 'name'
                            ? {
                                ...f,
                                renderFormItem: (form: any) => (
                                    <Form.Item name="name" noStyle>
                                        <input
                                            style={{
                                                width: '100%',
                                                padding: '4px 11px',
                                                border: '1px solid #d9d9d9',
                                                borderRadius: 6,
                                                background: '#f5f5f5',
                                                color: '#999',
                                                cursor: 'not-allowed',
                                                lineHeight: '22px',
                                            }}
                                            value={form.getFieldValue('name')}
                                            readOnly
                                        />
                                    </Form.Item>
                                ),
                            }
                            : f,
                    );
                }}
                actionBtnComponents={(record: McpServerInfo) => (
                    <>
                        {record.status.state === 'connected' && (
                            <Button type="link" onClick={() => setToolsFor(record.name)}>
                                工具
                            </Button>
                        )}
                        {record.status.state === 'connected' ? (
                            <Button
                                type="link"
                                onClick={async () => {
                                    await invoke('mcp_disconnect', { name: record.name });
                                    setRefreshKey(k => k + 1);
                                }}
                            >
                                断开
                            </Button>
                        ) : (
                            <Button
                                type="link"
                                disabled={record.config.enabled === false}
                                onClick={async () => {
                                    await invoke('mcp_reconnect', { name: record.name });
                                    setRefreshKey(k => k + 1);
                                }}
                            >
                                连接
                            </Button>
                        )}
                    </>
                )}
            />

            {toolsFor && (
                <McpToolsModal
                    serverName={toolsFor}
                    onClose={() => setToolsFor(null)}
                />
            )}
        </div>
    );
};
