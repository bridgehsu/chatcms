import React from 'react';
import { Checkbox, Radio, Tag } from 'antd';
import type { Skill } from '@/types';

export type SkillsConfig = { mode: 'all' | 'none' | 'allowlist'; skills: string[] };

const SkillsField: React.FC<{
    value?: SkillsConfig;
    onChange?: (v: SkillsConfig) => void;
    skillOptions: Skill[];
}> = ({value = {mode: 'all', skills: []}, onChange, skillOptions}) => {
    const set = (patch: Partial<SkillsConfig>) => onChange?.({...value, ...patch});

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            <Radio.Group
                value={value.mode}
                onChange={e => set({mode: e.target.value, skills: value.skills})}
                optionType="button"
                buttonStyle="solid"
                size="small"
            >
                <Radio.Button value="all">全部技能</Radio.Button>
                <Radio.Button value="allowlist">指定白名单</Radio.Button>
                <Radio.Button value="none">不使用</Radio.Button>
            </Radio.Group>

            {value.mode === 'allowlist' && (
                <div style={{
                    padding: '8px 12px',
                    background: 'var(--ant-color-fill-quaternary, #fafafa)',
                    borderRadius: 6,
                    border: '1px solid var(--ant-color-border, #d9d9d9)',
                    maxHeight: 200,
                    overflowY: 'auto',
                }}>
                    {skillOptions.length === 0 ? (
                        <span style={{color: '#999', fontSize: 12}}>
                            暂无可用技能，请先到技能管理添加
                        </span>
                    ) : (
                        <Checkbox.Group
                            value={value.skills}
                            onChange={checked => set({skills: checked as string[]})}
                            style={{display: 'flex', flexDirection: 'column', gap: 6, width: '100%'}}
                        >
                            {skillOptions.map(s => (
                                <Checkbox key={s.name} value={s.name}>
                                    <Tag style={{margin: 0, fontFamily: 'monospace', fontSize: 11}}>{s.name}</Tag>
                                    <span style={{color: '#888', fontSize: 12, marginLeft: 6}}>
                                        {s.description}
                                    </span>
                                </Checkbox>
                            ))}
                        </Checkbox.Group>
                    )}
                </div>
            )}
        </div>
    );
};

export default SkillsField;
