import React from 'react';
import { Select, Tag } from 'antd';
import type { DomainPolicy } from '@/types';

const OVERRIDE_DOMAINS = [
    {id: 'file_read', label: '文件读取'},
    {id: 'file_write', label: '文件写入'},
    {id: 'shell',      label: '终端'},
    {id: 'mcp',        label: 'MCP'},
    {id: 'agent',      label: '子代理'},
    {id: 'network',    label: '网络'},
    {id: 'browser',    label: '浏览器'},
    {id: 'app',        label: '应用'},
];

const POLICY_OPTIONS = [
    {value: '',      label: '继承', color: 'default'},
    {value: 'allow', label: '允许', color: 'success'},
    {value: 'ask',   label: '询问', color: 'warning'},
    {value: 'deny',  label: '拒绝', color: 'error'},
];

const PermField: React.FC<{
    value?: Record<string, DomainPolicy>;
    onChange?: (v: Record<string, DomainPolicy>) => void;
}> = ({value = {}, onChange}) => {
    const set = (id: string, policy: DomainPolicy | '') => {
        const next = {...value};
        if (!policy) delete next[id];
        else next[id] = policy as DomainPolicy;
        onChange?.(next);
    };

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 12px',
            padding: '10px 12px',
            background: 'var(--ant-color-fill-quaternary, #fafafa)',
            borderRadius: 6,
            border: '1px solid var(--ant-color-border, #d9d9d9)',
        }}>
            {OVERRIDE_DOMAINS.map(d => (
                <div key={d.id} style={{display: 'flex', alignItems: 'center', gap: 8, minWidth: 0}}>
                    <span style={{flex: 1, fontSize: 13, color: 'var(--ant-color-text-secondary)', whiteSpace: 'nowrap'}}>
                        {d.label}
                    </span>
                    <Select
                        size="small"
                        style={{width: 80}}
                        value={value[d.id] ?? ''}
                        onChange={v => set(d.id, v)}
                        options={POLICY_OPTIONS.map(o => ({
                            value: o.value,
                            label: <Tag color={o.color} style={{margin: 0, fontSize: 11}}>{o.label}</Tag>,
                        }))}
                        popupMatchSelectWidth={false}
                    />
                </div>
            ))}
        </div>
    );
};

export default PermField;
