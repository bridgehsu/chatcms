import React from 'react';
import {App as AntdApp, Button, Dropdown, Space} from 'antd';
import type {MenuProps} from 'antd';
import {
    CaretRightOutlined,
    DeleteOutlined,
    EditOutlined,
    MoreOutlined,
    PauseCircleOutlined,
    PlayCircleOutlined,
} from '@ant-design/icons';

export type ActionItem = {
    key: string;
    label: React.ReactNode;
    icon?: React.ReactNode;
    danger?: boolean;
    disabled?: boolean;
    onClick?: () => void;
};

/** 将 actionBtnComponents 里的 Button / Fragment 展平为菜单项 */
const flattenButtons = (node: React.ReactNode): ActionItem[] => {
    const items: ActionItem[] = [];
    const walk = (n: React.ReactNode, prefix: string) => {
        React.Children.forEach(n, (child, i) => {
            if (child == null || typeof child === 'boolean') return;
            if (!React.isValidElement(child)) return;
            if (child.type === React.Fragment) {
                walk((child.props as {children?: React.ReactNode}).children, `${prefix}${i}-`);
                return;
            }
            const props = child.props as {
                children?: React.ReactNode;
                icon?: React.ReactNode;
                danger?: boolean;
                disabled?: boolean;
                onClick?: (e?: React.MouseEvent) => void;
            };
            items.push({
                key: `${prefix}${i}`,
                label: props.children,
                icon: props.icon,
                danger: props.danger,
                disabled: props.disabled,
                onClick: props.onClick ? () => props.onClick!() : undefined,
            });
        });
    };
    walk(node, 'custom-');
    return items;
};

/**
 * 操作区：仅 1 个时带文案；超过 1 个时外露首项（主操作），其余收进「更多」。
 */
export const ActionOverflow: React.FC<{items: ActionItem[]}> = ({items}) => {
    if (items.length === 0) return null;

    if (items.length === 1) {
        const only = items[0];
        return (
            <Button
                type="link"
                icon={only.icon}
                danger={only.danger}
                disabled={only.disabled}
                onClick={only.onClick}
            >
                {only.label}
            </Button>
        );
    }

    const [primary, ...rest] = items;
    const menuItems: MenuProps['items'] = [];
    rest.forEach((item, idx) => {
        if (item.danger && idx > 0 && !rest[idx - 1]?.danger) {
            menuItems.push({type: 'divider'});
        }
        menuItems.push({
            key: item.key,
            label: item.label,
            icon: item.icon,
            danger: item.danger,
            disabled: item.disabled,
        });
    });

    return (
        <Space size={2}>
            <Button
                type="link"
                icon={primary.icon}
                danger={primary.danger}
                disabled={primary.disabled}
                onClick={primary.onClick}
            >
                {primary.label}
            </Button>
            <Dropdown
                trigger={['click']}
                menu={{
                    items: menuItems,
                    onClick: ({key}) => {
                        rest.find((item) => item.key === key)?.onClick?.();
                    },
                }}
            >
                <Button type="link" icon={<MoreOutlined/>} aria-label="更多操作"/>
            </Dropdown>
        </Space>
    );
};

interface ActionProps {
    record: any;
    rowKey: string;
    api: {
        enable?: (id: number | string, enabled: boolean) => Promise<any>;
        enabled?: (id: number | string, enabled: boolean) => Promise<any>;
        execute?: (id: number | string) => Promise<any>;
        del?: (id: number | string) => Promise<any>;
    };
    handleEdit: (record: any) => void;
    handleDelete: (id: number | string) => Promise<void>;
    fetchData: (formValues: any, pageNum: number, pageSize: number) => Promise<void>;
    searchFormValues: any;
    pagination: {
        pageNum: number;
        pageSize: number;
    };
    actionBtnComponents?: (record: any) => React.ReactNode;
}

const Action: React.FC<ActionProps> = (props) => {
    const {record, rowKey, api, handleEdit, handleDelete, fetchData, searchFormValues, pagination, actionBtnComponents} = props;
    const enableApi = api.enable || api.enabled;
    const isEnabled = record.enabled === 1;
    const {modal, message} = AntdApp.useApp();

    const handleToggleEnable = () => {
        const nextEnabled = !isEnabled;
        modal.confirm({
            title: nextEnabled ? '确认启用' : '确认停用',
            content: nextEnabled ? '确定要启用该项吗？' : '确定要停用该项吗？',
            onOk: () => enableApi!(record[rowKey], nextEnabled)
                .then(() => {
                    message.success(nextEnabled ? '启用成功' : '停用成功');
                    return fetchData(searchFormValues, pagination.pageNum, pagination.pageSize);
                })
                .catch((err: any) => {
                    message.error(String(err) || '操作失败');
                }),
        });
    };

    const handleExecute = () => {
        modal.confirm({
            title: '确认执行',
            content: '确定要立即执行当前函数吗？',
            onOk: () => api.execute!(record[rowKey])
                .then(() => {
                    message.success('执行成功');
                })
                .catch((err: any) => {
                    message.error(String(err) || '执行失败');
                }),
        });
    };

    const handleDeleteConfirm = () => {
        modal.confirm({
            title: '确认删除',
            content: '确定要删除该项吗？',
            okText: '确认',
            cancelText: '取消',
            onOk: () => handleDelete(record[rowKey]!)
                .then(() => {
                    message.success('删除成功');
                })
                .catch((err: any) => {
                    message.error(String(err) || '删除失败');
                }),
        });
    };

    const items: ActionItem[] = [
        {
            key: 'edit',
            label: '编辑',
            icon: <EditOutlined/>,
            onClick: () => handleEdit(record),
        },
        ...flattenButtons(actionBtnComponents?.(record)),
        ...(enableApi
            ? [{
                key: 'enable',
                label: isEnabled ? '停用' : '启用',
                icon: isEnabled ? <PauseCircleOutlined/> : <PlayCircleOutlined/>,
                onClick: handleToggleEnable,
            }]
            : []),
        ...(api.execute
            ? [{
                key: 'execute',
                label: '执行',
                icon: <CaretRightOutlined/>,
                onClick: handleExecute,
            }]
            : []),
        {
            key: 'delete',
            label: '删除',
            icon: <DeleteOutlined/>,
            danger: true,
            onClick: handleDeleteConfirm,
        },
    ];

    return <ActionOverflow items={items}/>;
};

export default Action;
