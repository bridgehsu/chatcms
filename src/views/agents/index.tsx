import React, { useEffect, useMemo, useState } from 'react';
import { Button, Switch } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import Dform from './components/DForm';
import { invoke } from '@/hooks/useTauri';
import type { AgentProfile, Skill } from '@/types';
import CabinX, { type CabinXColumn } from '@/components/CabinX';
import { formatTime } from '@/utils/time';
import SkillsField, { type SkillsConfig } from './components/SkillsField';
import PermField from './components/PermField';

// ── AgentsPage ────────────────────────────────────────────────────────────────
export const AgentsPage = () => {
    const [skillOptions, setSkillOptions] = useState<Skill[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewRecord, setViewRecord] = useState<AgentProfile | null>(null);

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
        del: async (id: string) => invoke('agent_remove', {id}),
    }), [refreshKey]);

    const formatRecordForEdit = (record: AgentProfile) => {
        let mode: 'all' | 'none' | 'allowlist' = 'all';
        if (record.skills !== null) {
            mode = record.skills.length === 0 ? 'none' : 'allowlist';
        }
        return {
            name: record.name,
            slug: record.slug,
            emoji: record.emoji,
            description: record.description,
            system_prompt: record.system_prompt,
            enabled: record.enabled,
            allow_as_subagent: record.allow_as_subagent,
            skillsConfig: {mode, skills: record.skills ?? []} as SkillsConfig,
            permissionOverrides: {...(record.permission_overrides ?? {})},
            workspace_dir: record.workspace_dir ?? '',
        };
    };

    const beforeSubmit = (values: any) => {
        const {skillsConfig, permissionOverrides, system_prompt, allow_as_subagent, workspace_dir: _ws, ...rest} = values;
        let skills: string[] | null = null;
        if (skillsConfig?.mode === 'none') skills = [];
        else if (skillsConfig?.mode === 'allowlist') skills = skillsConfig.skills ?? [];
        return {
            ...rest,
            systemPrompt: system_prompt,
            skills,
            allowAsSubagent: allow_as_subagent ?? true,
            permissionOverrides: permissionOverrides ?? {},
        };
    };

    const columns: CabinXColumn<AgentProfile>[] = [
        {
            title: '编号',
            dataIndex: 'code',
            key: 'code',
            hideInTable: true,
        },
        {
            title: '代理名称',
            dataIndex: 'name',
            key: 'name',
            fixed: 'left',
            render: (_: any, record: AgentProfile) =>
                `${record.emoji ? record.emoji + ' ' : ''}${record.name}`,
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
            title: 'ID',
            dataIndex: 'slug',
            key: 'slug',
            editor: {
                name: 'slug',
                label: 'ID（slug）',
                type: 'input',
                rules: [{required: true, message: '请输入 slug'}],
                placeholder: 'writer',
            },
        },
        {
            title: 'Emoji',
            dataIndex: 'emoji',
            key: 'emoji',
            hideInTable: true,
            editor: {name: 'emoji', label: 'Emoji', type: 'input', placeholder: '✍️'},
        },
        {
            title: '简介',
            dataIndex: 'description',
            key: 'description',
            editor: {
                name: 'description',
                label: '简介',
                type: 'input',
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
            title: '子代理',
            dataIndex: 'allow_as_subagent',
            key: 'allow_as_subagent',
            render: (v: boolean) => (v ? '允许' : '禁止'),
            editor: {
                name: 'allow_as_subagent',
                label: '允许作为子代理',
                type: 'switch',
                valuePropName: 'checked',
                initialValue: true,
            },
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
            editor: {
                name: 'enabled',
                label: '启用此代理',
                type: 'switch',
                valuePropName: 'checked',
                initialValue: true,
            },
        },
        {
            title: '权限覆盖',
            dataIndex: 'permission_overrides',
            key: 'permission_overrides',
            hideInTable: true,
            editor: {
                name: 'permissionOverrides',
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
                renderFormItem: (form: any) => {
                    const dir = form.getFieldValue('workspace_dir');
                    return (
                        <span style={{fontSize: 12, color: '#888', wordBreak: 'break-all'}}>
                            {dir || '新增后自动生成'}
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
                editorWidth={800}
                actionBtnComponents={(record: AgentProfile) => (
                    <Button type="link" icon={<EyeOutlined/>} onClick={() => setViewRecord(record)}>
                        查看
                    </Button>
                )}
            />

            <Dform record={viewRecord} onClose={() => setViewRecord(null)} />
        </div>
    );
};
