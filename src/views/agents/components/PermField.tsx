import React from 'react';
import type { DomainPolicy } from '@/types';

const OVERRIDE_DOMAINS = [
    {id: 'file_read', label: '文件读取'},
    {id: 'file_write', label: '文件写入'},
    {id: 'shell', label: '终端'},
    {id: 'mcp', label: 'MCP'},
    {id: 'agent', label: '子代理'},
    {id: 'network', label: '网络'},
    {id: 'browser', label: '浏览器'},
    {id: 'app', label: '应用'},
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
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px'}}>
            {OVERRIDE_DOMAINS.map(d => (
                <div key={d.id} style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <span style={{flex: 1, fontSize: 13}}>{d.label}</span>
                    <select
                        style={{
                            border: '1px solid #d9d9d9',
                            borderRadius: 4,
                            padding: '2px 4px',
                            fontSize: 13,
                            background: 'transparent',
                        }}
                        value={value[d.id] ?? ''}
                        onChange={e => set(d.id, e.target.value as DomainPolicy | '')}
                    >
                        <option value="">继承</option>
                        <option value="allow">允许</option>
                        <option value="ask">询问</option>
                        <option value="deny">拒绝</option>
                    </select>
                </div>
            ))}
        </div>
    );
};

export default PermField;
