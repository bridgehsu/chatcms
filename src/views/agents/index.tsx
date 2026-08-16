import React, { useEffect, useMemo, useState } from 'react';
import { Button, Col, Form, InputNumber, Row, Switch } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { invoke } from '@/hooks/useTauri';
import type { AgentProfile, Skill } from '@/types';
import CabinX, { type CabinXColumn, type FormField } from '@/components/CabinX';
import Editor from '@/components/CabinX/Editor';
import { formatTime } from '@/utils/time';
import SkillsField, { type SkillsConfig } from './components/SkillsField';
import PermField from './components/PermField';

// ── AgentsPage ────────────────────────────────────────────────────────────────
export const AgentsPage = () => {
    const [skillOptions, setSkillOptions] = useState<Skill[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewForm] = Form.useForm();
    const [viewOpen, setViewOpen] = useState(false);
    const [viewTitle, setViewTitle] = useState('');

    useEffect(() => {
        void invoke<Skill[]>('skill_list').then(setSkillOptions).catch(console.error);
    }, []);

    const api = useMemo(() => ({
        paging: async (params: any) => {
            void refreshKey;
            let list = await invoke<AgentProfile[]>('agent_list');
            if (params?.name?.trim()) {
                const q = params.name.trim().toLowerCase();
                list = list.filter(a => a.name.toLowerCase().includes(q));
            }
            return {list, total: list.length, pageNum: 1, pageSize: Math.max(list.length, 10)};
        },
        add: async (data: any) => invoke('agent_add', data),
        edit: async (data: any) => {
            const {id, ...rest} = data;
            return invoke('agent_update', {id, ...rest});
        },
        del: async (id: string | number) => invoke('agent_remove', {id: String(id)}),
    }), [refreshKey]);

    const formatRecordForEdit = (record: AgentProfile) => {
        let mode: 'all' | 'none' | 'allowlist' = 'all';
        if (record.skills !== null) {
            mode = record.skills.length === 0 ? 'none' : 'allowlist';
        }
        return {
            name: record.name,
            slug: record.slug,
            remark: record.remark,
            system_prompt: record.system_prompt,
            enabled: record.enabled,
            spawnable: record.spawnable,
            sort: record.sort,
            skillsConfig: {mode, skills: record.skills ?? []} as SkillsConfig,
            permOverrides: {...(record.perms ?? {})},
            workspace_dir: record.workspace_dir ?? '',
        };
    };

    const beforeSubmit = (values: any) => {
        const {skillsConfig, permOverrides, workspace_dir: _ws, ...rest} = values;
        let skills: string[] | null = null;
        if (skillsConfig?.mode === 'none') skills = [];
        else if (skillsConfig?.mode === 'allowlist') skills = skillsConfig.skills ?? [];
        return {
            ...rest,
            skills,
            perms: permOverrides ?? {},
        };
    };

    const columns: CabinXColumn<AgentProfile>[] = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            fixed: 'left',
            search: {name: 'name', label: '代理名称', type: 'input', placeholder: '搜索代理名称'},
            editor: {
                name: 'name',
                label: '代理名称',
                type: 'input',
                rules: [{required: true, message: '请输入代理名称'}],
                placeholder: '内容写手',
            },
        },
        {
            title: '短标识',
            dataIndex: 'slug',
            key: 'slug',
            editor: {
                name: 'slug',
                label: '短标识',
                type: 'input',
                rules: [{required: true, message: '请输入短标识'}],
                placeholder: 'writer',
            },
        },
        // 允许作为子代理 / 启用此代理 / 排序权重 三字段同行
        {
            title: '',
            dataIndex: '__row_config',
            key: '__row_config',
            hideInTable: true,
            editor: {
                name: undefined as any,
                label: undefined as any,
                type: 'input',
                renderFormItem: () => (
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="spawnable" label="允许作为子代理" valuePropName="checked" initialValue={true} style={{marginBottom: 0}}>
                                <Switch checkedChildren="允许" unCheckedChildren="禁止" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="enabled" label="启用此代理" valuePropName="checked" initialValue={true} style={{marginBottom: 0}}>
                                <Switch checkedChildren="启用" unCheckedChildren="停用" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="sort" label="排序权重" initialValue={0} style={{marginBottom: 0}}>
                                <InputNumber style={{width: '100%'}} min={0} placeholder="数字越小越靠前" />
                            </Form.Item>
                        </Col>
                    </Row>
                ),
            },
        },
        {
            title: '简介',
            dataIndex: 'remark',
            key: 'remark',
            editor: {
                name: 'remark',
                label: '简介',
                type: 'textarea',
                rows: 3,
                placeholder: '一句话说明职责',
            },
        },
        {
            title: '系统提示',
            dataIndex: 'system_prompt',
            key: 'system_prompt',
            hideInTable: true,
            editor: {
                name: 'system_prompt',
                label: '系统提示',
                type: 'textarea',
                rows: 6,
                placeholder: '你是一位专业的……，你的职责是……',
            },
        },
        {
            title: '技能',
            dataIndex: 'skills',
            key: 'skills',
            render: (skills: string[] | null) => {
                if (skills === null) return '全部';
                if (skills.length === 0) return '无';
                return skills.join(', ');
            },
            editor: {
                name: 'skillsConfig',
                label: '技能配置',
                type: 'input',
                initialValue: {mode: 'all', skills: []} as SkillsConfig,
                renderFormItem: () => <SkillsField skillOptions={skillOptions}/>,
            },
        },
        {
            title: '可被调用',
            dataIndex: 'spawnable',
            key: 'spawnable',
            render: (v: boolean) => (v ? '允许' : '禁止'),
        },
        {
            title: '状态',
            dataIndex: 'enabled',
            key: 'enabled',
            render: (enabled: boolean, record: AgentProfile) => (
                <Switch
                    size="small"
                    checked={enabled}
                    onChange={async (checked) => {
                        await invoke('agent_update', {id: record.id, enabled: checked});
                        setRefreshKey(k => k + 1);
                    }}
                />
            ),
        },
        {
            title: '权限覆盖',
            dataIndex: 'perms',
            key: 'perms',
            hideInTable: true,
            editor: {
                name: 'permOverrides',
                label: '权限覆盖',
                type: 'input',
                initialValue: {},
                renderFormItem: () => <PermField/>,
            },
        },
        {
            title: 'Workspace',
            dataIndex: 'workspace_dir',
            key: 'workspace_dir',
            hideInTable: true,
            editor: {
                name: 'workspace_dir',
                label: 'Workspace 路径',
                type: 'input',
                hide: [true, true, false],
                renderFormItem: (form: any) => {
                    const dir = form.getFieldValue('workspace_dir');
                    return (
                        <span style={{fontSize: 12, color: '#888', wordBreak: 'break-all'}}>
                            {dir || '未生成'}
                        </span>
                    );
                },
            },
        },
        {
            title: '更新',
            dataIndex: 'updated',
            key: 'updated',
            render: (ms: number) => formatTime(ms),
        },
    ];

    // 从 columns 中提取编辑器字段，供只读查看 Drawer 复用
    const editorFormFields = useMemo<FormField[]>(() =>
        columns
            .filter(col => col.editor && typeof col.editor === 'object')
            .map(col => {
                const editor = col.editor as FormField;
                return {
                    ...editor,
                    name: editor.name ?? (col.dataIndex as string),
                    label: editor.label ?? (col.title as string),
                };
            })
            .filter(f => !f.hide?.[2]),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [skillOptions],
    );

    const handleView = (record: AgentProfile) => {
        setViewTitle(record.name);
        viewForm.setFieldsValue(formatRecordForEdit(record));
        setViewOpen(true);
    };

    return (
        <div className="page page-scroll">
            <CabinX
                api={api}
                columns={columns}
                pageTitle="代理管理"
                rowKey="id"
                formatRecordForEdit={formatRecordForEdit}
                beforeSubmit={beforeSubmit}
                formType="D"
                editorWidth={650}
                actionBtnComponents={(record: AgentProfile) => (
                    <Button type="link" icon={<EyeOutlined/>} onClick={() => handleView(record)}>
                        查看
                    </Button>
                )}
            />

            <Editor
                title={viewTitle}
                open={viewOpen}
                onClose={() => setViewOpen(false)}
                onSubmit={async () => {}}
                formFields={editorFormFields}
                loading={false}
                form={viewForm}
                type="D"
                width={650}
                readOnly
            />
        </div>
    );
};
