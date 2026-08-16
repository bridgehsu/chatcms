import React from 'react';
import {App as AntdApp, Button, Space} from 'antd';
import {CaretRightOutlined, DeleteOutlined, EditOutlined, PauseCircleOutlined, PlayCircleOutlined} from '@ant-design/icons';

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

    return (
        <Space size={2}>
            {enableApi && (
                <Button type="link" icon={isEnabled ? <PauseCircleOutlined/> : <PlayCircleOutlined/>} onClick={handleToggleEnable}>
                    {isEnabled ? '停用' : '启用'}
                </Button>
            )}
            {api.execute && (
                <Button type="link" icon={<CaretRightOutlined/>} onClick={handleExecute}>
                    执行
                </Button>
            )}
            {actionBtnComponents && actionBtnComponents(record)}
            <Button type="link" icon={<EditOutlined/>} onClick={() => handleEdit(record)}>
                编辑
            </Button>
            <Button type="link" danger icon={<DeleteOutlined/>} onClick={handleDeleteConfirm}>
                删除
            </Button>
        </Space>
    );
};

export default Action;
