import React from 'react';
import { Button, Select, Tag } from 'antd';
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
    {value: '',      label: '继承', color: 'default',  dot: '#c0c0c0'},
    {value: 'allow', label: '允许', color: 'success',  dot: '#52c41a'},
    {value: 'ask',   label: '询问', color: 'warning',  dot: '#faad14'},
    {value: 'deny',  label: '拒绝', color: 'error',    dot: '#ff4d4f'},
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

    const overrideCount = Object.keys(value).length;

    return (
        <div style={{
            padding: '8px 12px 10px',
            background: 'var(--ant-color-fill-quaternary, #fafafa)',
            borderRadius: 6,
            border: '1px solid var(--ant-color-border, #d9d9d9)',
        }}>
            {/* 标题栏 */}
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                <span style={{fontSize: 12, color: 'var(--ant-color-text-secondary)'}}>
                    {overrideCount > 0 ? `已覆盖 ${overrideCount} 项` : '全部继承全局策略'}
                </span>
                {overrideCount > 0 && (
                    <Button type="link" size="small" style={{padding: 0, height: 'auto', fontSize: 12}}
                            onClick={() => onChange?.({})}>
                        重置全部
                    </Button>
                )}
            </div>

            {/* 域列表 */}
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px'}}>
                {OVERRIDE_DOMAINS.map(d => (
                    <div key={d.id} style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <span style={{flex: 1, fontSize: 13, color: 'var(--ant-color-text)', whiteSpace: 'nowrap'}}>
                            {d.label}
                        </span>
                        <Select
                            size="small"
                            style={{width: 80}}
                            value={value[d.id] ?? ''}
                            onChange={v => set(d.id, v)}
                            popupMatchSelectWidth={false}
                            // 触发器：彩色小圆点 + 文字，紧凑不拥挤
                            labelRender={({value: v}) => {
                                const opt = POLICY_OPTIONS.find(o => o.value === v) ?? POLICY_OPTIONS[0];
                                return (
                                    <span style={{display: 'flex', alignItems: 'center', gap: 5}}>
                                        <span style={{
                                            width: 7, height: 7, borderRadius: '50%',
                                            background: opt.dot, flexShrink: 0,
                                        }}/>
                                        <span style={{fontSize: 12}}>{opt.label}</span>
                                    </span>
                                );
                            }}
                            options={POLICY_OPTIONS.map(o => ({
                                value: o.value,
                                label: (
                                    <Tag color={o.color} style={{margin: 0, fontSize: 11}}>
                                        {o.label}
                                    </Tag>
                                ),
                            }))}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PermField;
