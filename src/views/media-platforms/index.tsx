import { useMemo } from 'react';
import { Button, Switch } from 'antd';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@/hooks/useTauri';
import type { MediaPlatformPage, MediaPlatformPageItem } from '@/types';
import CabinX, { type CabinXColumn } from '@/components/CabinX';
import { formatTime } from '@/utils/time';

const KIND_SEARCH_OPTIONS = [
    { label: '全部类型', value: 'all' },
    { label: '动态', value: 'dynamic' },
    { label: '文章', value: 'article' },
    { label: '视频', value: 'video' },
];

const KIND_FORM_OPTIONS = [
    { label: '动态', value: 'dynamic' },
    { label: '文章', value: 'article' },
    { label: '视频', value: 'video' },
];

const KIND_LABEL: Record<string, string> = { dynamic: '动态', article: '文章', video: '视频' };

const scriptStatus = (row: MediaPlatformPageItem) => {
    if (!row.script_is_published) return <span className="model-status-idle">未发布</span>;
    if (row.script_has_unpublished_draft) return <span className="model-badge">有草稿 · v{row.script_published_version}</span>;
    return <span className="model-badge">已发布 · v{row.script_published_version}</span>;
};

const collectStatus = (row: MediaPlatformPageItem) => {
    if (!row.collect_script_is_published) return <span className="model-status-idle">未发布</span>;
    if (row.collect_script_has_unpublished_draft) return <span className="model-badge">有草稿 · v{row.collect_script_published_version}</span>;
    return <span className="model-badge">已发布 · v{row.collect_script_published_version}</span>;
};

export const MediaPlatformsPage = () => {
    const navigate = useNavigate();

    const api = useMemo(() => ({
        paging: async (params: any) => {
            const result = await invoke<MediaPlatformPage>('media_platform_list_page', {
                query: params?.name?.trim() || null,
                kind: params?.kind && params.kind !== 'all' ? params.kind : null,
                page: params?.pageNum ?? 1,
                pageSize: params?.pageSize ?? 10,
            });
            return {
                list: result.items,
                total: result.total,
                pageNum: result.page,
                pageSize: result.page_size,
            };
        },
        add: async (data: any) => invoke('media_platform_upsert', { id: null, ...data }),
        edit: async (data: any) => {
            const { id, ...rest } = data;
            return invoke('media_platform_upsert', { id, ...rest });
        },
        del: async (id: string | number) => invoke('media_platform_remove', { id: String(id) }),
    }), []);

    const formatRecordForEdit = (record: MediaPlatformPageItem) => ({
        code: record.code,
        name: record.name,
        kind: record.kind || 'dynamic',
        injectUrl: record.inject_url,
        homeUrl: record.home_url,
        enabled: record.enabled,
        notes: record.notes,
    });

    const columns: CabinXColumn<MediaPlatformPageItem>[] = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            search: { name: 'name', label: '关键词', type: 'input', placeholder: '搜索名称、编码、URL…' },
            editor: {
                name: 'name',
                label: '名称',
                type: 'input',
                rules: [{ required: true, message: '请输入名称' }],
                placeholder: '如：小红书',
            },
            render: (name: string, record: MediaPlatformPageItem) => (
                <>
                    <span className="model-table__name">{name}</span>
                    {record.notes && <div className="account-table__notes">{record.notes}</div>}
                </>
            ),
        },
        {
            title: '编码',
            dataIndex: 'code',
            key: 'code',
            editor: {
                name: 'code',
                label: '编码',
                type: 'input',
                rules: [{ required: true, message: '请输入编码' }],
                placeholder: '如：DYNAMIC_REDNOTE',
            },
        },
        {
            title: '类型',
            dataIndex: 'kind',
            key: 'kind',
            search: {
                name: 'kind',
                label: '类型',
                type: 'select',
                options: KIND_SEARCH_OPTIONS,
                placeholder: '全部类型',
            },
            editor: {
                name: 'kind',
                label: '类型',
                type: 'select',
                options: KIND_FORM_OPTIONS,
                initialValue: 'dynamic',
            },
            render: (kind: string) => KIND_LABEL[kind] ?? kind,
        },
        {
            title: '注入页',
            dataIndex: 'inject_url',
            key: 'inject_url',
            editor: {
                name: 'injectUrl',
                label: '注入页 URL',
                type: 'input',
                placeholder: '扩展打开并注入脚本的页面',
            },
            render: (v: string) => <span className="model-table__mono model-table__url">{v || '—'}</span>,
        },
        {
            title: '主页',
            dataIndex: 'home_url',
            key: 'home_url',
            hideInTable: true,
            editor: {
                name: 'homeUrl',
                label: '主页 URL',
                type: 'input',
                placeholder: '可选',
            },
        },
        {
            title: '备注',
            dataIndex: 'notes',
            key: 'notes',
            hideInTable: true,
            editor: {
                name: 'notes',
                label: '备注',
                type: 'input',
                placeholder: '可选说明',
            },
        },
        {
            title: '',
            dataIndex: '__enabled_form',
            key: '__enabled_form',
            hideInTable: true,
            editor: {
                name: 'enabled',
                label: '启用（扩展桥仅返回已启用平台）',
                type: 'switch',
                valuePropName: 'checked',
                initialValue: true,
                checkedChildren: '启用',
                unCheckedChildren: '停用',
            },
        },
        {
            title: '发布脚本',
            dataIndex: 'script_is_published',
            key: 'script_is_published',
            render: (_: any, record: MediaPlatformPageItem) => scriptStatus(record),
        },
        {
            title: '采集脚本',
            dataIndex: 'collect_script_is_published',
            key: 'collect_script_is_published',
            render: (_: any, record: MediaPlatformPageItem) => collectStatus(record),
        },
        {
            title: '状态',
            dataIndex: 'enabled',
            key: 'enabled',
            render: (enabled: boolean, record: MediaPlatformPageItem) => (
                <Switch
                    size="small"
                    checked={enabled}
                    onChange={async (checked) => {
                        await invoke('media_platform_set_enabled', { id: record.id, enabled: checked });
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

    return (
        <div className="page page-scroll">
            <CabinX
                api={api}
                columns={columns}
                pageTitle="媒体平台"
                rowKey="id"
                formatRecordForEdit={formatRecordForEdit}
                formType="D"
                editorWidth={520}
                actionBtnComponents={(record: MediaPlatformPageItem) => (
                    <>
                        <Button
                            type="link"
                            onClick={() => navigate(`/media-platforms/${record.id}/script`)}
                        >
                            发布脚本
                        </Button>
                        <Button
                            type="link"
                            onClick={() => navigate(`/media-platforms/${record.id}/collect-script`)}
                        >
                            采集脚本
                        </Button>
                    </>
                )}
            />
        </div>
    );
};

export { MediaScriptPage, CollectScriptPage } from './MediaScriptPage';
