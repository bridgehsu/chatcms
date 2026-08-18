import { useMemo } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@/hooks/useTauri';
import type { ScheduleProject } from '@/types';
import CabinX, { type CabinXColumn } from '@/components/CabinX';
import { formatTime } from '@/utils/time';

export const SchedulesPage = () => {
    const navigate = useNavigate();

    const api = useMemo(() => ({
        paging: async (params: any) => {
            let list = await invoke<ScheduleProject[]>('schedule_list');
            if (params?.name?.trim()) {
                const q = params.name.trim().toLowerCase();
                list = list.filter(p =>
                    [p.name, p.description].join(' ').toLowerCase().includes(q),
                );
            }
            return { list, total: list.length, pageNum: 1, pageSize: Math.max(list.length, 10) };
        },
        add: async (data: any) => {
            const created = await invoke<ScheduleProject>('schedule_add', {
                name: data.name?.trim(),
                description: data.description?.trim() ?? '',
                enabled: data.enabled ?? true,
            });
            navigate(`/schedules/${created.id}`);
            return created;
        },
        edit: async (data: any) => {
            const { id, ...rest } = data;
            return invoke('schedule_update', {
                id,
                name: rest.name?.trim(),
                description: rest.description?.trim() ?? '',
                enabled: rest.enabled ?? true,
            });
        },
        del: async (id: string | number) => invoke('schedule_remove', { id: String(id) }),
    }), [navigate]);

    const columns: CabinXColumn<ScheduleProject>[] = [
        {
            title: '项目',
            dataIndex: 'name',
            key: 'name',
            search: { name: 'name', label: '关键词', type: 'input', placeholder: '搜索项目名称、描述…' },
            editor: {
                name: 'name',
                label: '项目名称',
                type: 'input',
                rules: [{ required: true, message: '请输入项目名称' }],
                placeholder: '例如：每日早报推送',
            },
            render: (name: string, record: ScheduleProject) => (
                <>
                    <span className="model-table__name">{name}</span>
                    {record.description && (
                        <div className="account-table__notes">{record.description}</div>
                    )}
                </>
            ),
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            hideInTable: true,
            editor: {
                name: 'description',
                label: '描述',
                type: 'input',
                placeholder: '流程用途说明',
            },
        },
        {
            title: '节点',
            dataIndex: 'workflow',
            key: 'nodes',
            render: (w: ScheduleProject['workflow']) => w?.nodes?.length ?? 0,
        },
        {
            title: '连线',
            dataIndex: 'workflow',
            key: 'edges',
            render: (w: ScheduleProject['workflow']) => w?.edges?.length ?? 0,
        },
        {
            title: '',
            dataIndex: '__enabled',
            key: '__enabled',
            hideInTable: true,
            editor: {
                name: 'enabled',
                label: '启用此项目',
                type: 'switch',
                valuePropName: 'checked',
                initialValue: true,
                checkedChildren: '启用',
                unCheckedChildren: '停用',
            },
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
                pageTitle="调度项目"
                rowKey="id"
                formType="D"
                editorWidth={480}
                actionBtnComponents={(record: ScheduleProject) => (
                    <Button
                        type="link"
                        onClick={() => navigate(`/schedules/${record.id}`)}
                    >
                        打开画布
                    </Button>
                )}
            />
        </div>
    );
};

export { WorkflowEditorPage } from './WorkflowEditorPage';
