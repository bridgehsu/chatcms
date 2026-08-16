import React from 'react';
import { Descriptions, Drawer, Tag } from 'antd';
import type { AgentProfile } from '@/types';
import { formatTime } from '@/utils/time';

interface Props {
    record: AgentProfile | null;
    onClose: () => void;
}

const Dform: React.FC<Props> = ({ record, onClose }) => (
    <Drawer
        title={record ? `${record.emoji ? record.emoji + ' ' : ''}${record.name}` : ''}
        open={!!record}
        onClose={onClose}
        width={600}
        closable
    >
        {record && (
            <Descriptions column={1} bordered size="small" labelStyle={{ width: 120 }}>
                <Descriptions.Item label="编号">{record.code}</Descriptions.Item>
                <Descriptions.Item label="ID（slug）">{record.slug}</Descriptions.Item>
                <Descriptions.Item label="名称">{record.name}</Descriptions.Item>
                <Descriptions.Item label="简介">{record.description || '—'}</Descriptions.Item>
                <Descriptions.Item label="系统提示">
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                        {record.system_prompt || '—'}
                    </pre>
                </Descriptions.Item>
                <Descriptions.Item label="技能">
                    {record.skills === null ? '全部' :
                     record.skills.length === 0 ? '无' :
                     record.skills.map(s => <Tag key={s}>{s}</Tag>)}
                </Descriptions.Item>
                <Descriptions.Item label="子代理">{record.allow_as_subagent ? '允许' : '禁止'}</Descriptions.Item>
                <Descriptions.Item label="状态">{record.enabled ? '启用' : '停止'}</Descriptions.Item>
                <Descriptions.Item label="Workspace">
                    <span style={{ fontSize: 12, wordBreak: 'break-all' }}>
                        {record.workspace_dir || '未生成'}
                    </span>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">{formatTime(record.created_at)}</Descriptions.Item>
                <Descriptions.Item label="更新时间">{formatTime(record.updated_at)}</Descriptions.Item>
            </Descriptions>
        )}
    </Drawer>
);

export default Dform;
