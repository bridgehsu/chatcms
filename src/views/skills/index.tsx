import { useMemo, useRef, useState } from 'react';
import { Button, Col, Form, Row, Switch } from 'antd';
import { invoke } from '@/hooks/useTauri';
import type { Skill } from '@/types';
import CabinX, { type CabinXColumn } from '@/components/CabinX';
import { formatTime } from '@/utils/time';

const DEFAULT_BODY = `# 技能标题\n\n## 何时使用\n\n…\n\n## 步骤\n\n1. …\n`;

const sourceLabel = (s: string) => {
    if (s === 'bundled') return '内置';
    if (s === 'managed') return '托管';
    return '工作区';
};

export const SkillsPage = () => {
    const [refreshKey, setRefreshKey] = useState(0);
    const [npxOpen, setNpxOpen] = useState(false);
    const [npxPkg, setNpxPkg] = useState('');
    const [npxBusy, setNpxBusy] = useState(false);
    const [npxResult, setNpxResult] = useState<string | null>(null);
    const npxInputRef = useRef<HTMLInputElement>(null);

    const api = useMemo(() => ({
        paging: async (params: any) => {
            void refreshKey;
            let list = await invoke<Skill[]>('skill_list');
            if (params?.source && params.source !== 'all') {
                list = list.filter(s => s.source === params.source);
            }
            if (params?.name?.trim()) {
                const q = params.name.trim().toLowerCase();
                list = list.filter(s =>
                    [s.name, s.description, s.body].join(' ').toLowerCase().includes(q),
                );
            }
            return { list, total: list.length, pageNum: 1, pageSize: Math.max(list.length, 10) };
        },
        add: async (data: any) => invoke('skill_add', data),
        edit: async (data: any) => {
            const { id, ...rest } = data;
            return invoke('skill_update', { id, ...rest });
        },
        del: async (id: string | number) => invoke('skill_remove', { id: String(id) }),
    }), [refreshKey]);

    const formatRecordForEdit = (record: Skill) => ({
        name: record.name,
        description: record.description,
        body: record.body || DEFAULT_BODY,
        homepage: record.homepage ?? '',
        enabled: record.enabled,
        userInvocable: record.user_invocable,
        disableModelInvocation: record.disable_model_invocation,
        _metadata: record.metadata,
    });

    const beforeSubmit = (values: any) => {
        const { _metadata, ...rest } = values;
        return {
            name: rest.name?.trim(),
            description: rest.description?.trim(),
            body: rest.body,
            enabled: rest.enabled ?? true,
            userInvocable: rest.userInvocable ?? true,
            disableModelInvocation: rest.disableModelInvocation ?? false,
            homepage: rest.homepage?.trim() || null,
            metadata: _metadata ?? null,
        };
    };

    const columns: CabinXColumn<Skill>[] = [
        {
            title: '来源',
            dataIndex: 'source',
            key: 'source',
            search: {
                name: 'source',
                label: '来源',
                type: 'select',
                options: [
                    { label: '全部', value: 'all' },
                    { label: '内置', value: 'bundled' },
                    { label: '工作区', value: 'workspace' },
                    { label: '托管', value: 'managed' },
                ],
                placeholder: '全部来源',
            },
            render: (s: string) => (
                <span className={`skill-source skill-source--${s}`}>{sourceLabel(s)}</span>
            ),
        },
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            search: { name: 'name', label: '关键词', type: 'input', placeholder: '搜索名称、描述、正文…' },
            editor: {
                name: 'name',
                label: '名称（slug）',
                type: 'input',
                rules: [{ required: true, message: '请输入技能名称' }],
                placeholder: 'content-publish',
            },
            render: (name: string, record: Skill) => (
                <>
                    <span className="model-table__mono">{name}</span>
                    {record.disable_model_invocation && (
                        <div className="account-table__notes">不注入提示词</div>
                    )}
                </>
            ),
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            editor: {
                name: 'description',
                label: '描述（触发条件）',
                type: 'input',
                rules: [{ required: true, message: '请输入描述' }],
                placeholder: '何时应使用该技能…',
            },
        },
        {
            title: '正文',
            dataIndex: 'body',
            key: 'body',
            hideInTable: true,
            editor: {
                name: 'body',
                label: '正文（SKILL.md body）',
                type: 'textarea',
                rows: 12,
                placeholder: '# 标题与步骤…',
                initialValue: DEFAULT_BODY,
            },
        },
        {
            title: '主页',
            dataIndex: 'homepage',
            key: 'homepage',
            hideInTable: true,
            editor: {
                name: 'homepage',
                label: '主页（可选）',
                type: 'input',
                placeholder: 'https://',
            },
        },
        {
            title: '',
            dataIndex: '__switches',
            key: '__switches',
            hideInTable: true,
            editor: {
                name: undefined as any,
                label: undefined as any,
                type: 'input',
                renderFormItem: () => (
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true} style={{ marginBottom: 0 }}>
                                <Switch checkedChildren="启用" unCheckedChildren="停用" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="userInvocable" label="用户可调用" valuePropName="checked" initialValue={true} style={{ marginBottom: 0 }}>
                                <Switch checkedChildren="是" unCheckedChildren="否" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="disableModelInvocation" label="不注入提示词" valuePropName="checked" initialValue={false} style={{ marginBottom: 0 }}>
                                <Switch checkedChildren="是" unCheckedChildren="否" />
                            </Form.Item>
                        </Col>
                    </Row>
                ),
            },
        },
        {
            title: '状态',
            dataIndex: 'enabled',
            key: 'enabled',
            render: (enabled: boolean, record: Skill) => (
                <Switch
                    size="small"
                    checked={enabled}
                    onChange={async (checked) => {
                        await invoke('skill_update', {
                            id: record.id,
                            name: record.name,
                            description: record.description,
                            body: record.body,
                            enabled: checked,
                            userInvocable: record.user_invocable,
                            disableModelInvocation: record.disable_model_invocation,
                            homepage: record.homepage ?? null,
                            metadata: record.metadata ?? null,
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
            render: (ms: number) => formatTime(ms),
        },
    ];

    const installNpx = async () => {
        const pkg = npxPkg.trim();
        if (!pkg) return;
        setNpxBusy(true);
        setNpxResult(null);
        try {
            const installed = await invoke<Skill[]>('skill_install_npx', { pkgName: pkg });
            setNpxResult(
                installed.length > 0
                    ? `已安装 ${installed.length} 个技能：${installed.map(s => s.name).join('、')}`
                    : '未发现新技能（包可能已安装）',
            );
            setNpxPkg('');
            setRefreshKey(k => k + 1);
        } catch (err) {
            setNpxResult(`错误：${String(err)}`);
        } finally {
            setNpxBusy(false);
        }
    };

    const closeNpx = () => {
        setNpxOpen(false);
        setNpxPkg('');
        setNpxResult(null);
    };

    return (
        <div className="page page-scroll">
            {npxOpen && (
                <div className="skill-npx-panel">
                    <div className="skill-npx-title">从 npm 安装技能包</div>
                    <div className="skill-npx-row">
                        <span className="skill-npx-prefix">npx --yes</span>
                        <input
                            ref={npxInputRef}
                            className="skill-npx-input"
                            type="text"
                            value={npxPkg}
                            onChange={e => setNpxPkg(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') void installNpx();
                                if (e.key === 'Escape') closeNpx();
                            }}
                            placeholder="@chatcms/skill-xxx 或 chatcms-skill-xxx"
                            disabled={npxBusy}
                            autoFocus
                        />
                        <button
                            type="button"
                            className="btn-primary skill-npx-btn"
                            onClick={() => void installNpx()}
                            disabled={!npxPkg.trim() || npxBusy}
                        >
                            {npxBusy ? '安装中…' : '安装'}
                        </button>
                        <button
                            type="button"
                            className="btn-ghost skill-npx-btn"
                            onClick={closeNpx}
                            disabled={npxBusy}
                        >
                            取消
                        </button>
                    </div>
                    {npxResult && <div className="skill-npx-result">{npxResult}</div>}
                </div>
            )}

            <CabinX
                api={api}
                columns={columns}
                pageTitle="技能管理"
                rowKey="id"
                formatRecordForEdit={formatRecordForEdit}
                beforeSubmit={beforeSubmit}
                formType="D"
                editorWidth={650}
                extraHeaderActions={
                    <Button onClick={() => { setNpxOpen(v => !v); setNpxPkg(''); setNpxResult(null); }}>
                        安装 NPX
                    </Button>
                }
                actionBtnComponents={(record: Skill) => (
                    <Button
                        type="link"
                        onClick={async () => {
                            const md = await invoke<string>('skill_export_md', { id: record.id });
                            await navigator.clipboard.writeText(md);
                        }}
                    >
                        复制 MD
                    </Button>
                )}
            />
        </div>
    );
};
