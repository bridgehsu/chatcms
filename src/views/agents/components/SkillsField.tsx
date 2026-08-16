import React from 'react';
import { Checkbox, Radio } from 'antd';
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
            >
                <Radio value="all">全部技能</Radio>
                <Radio value="allowlist">指定白名单</Radio>
                <Radio value="none">不使用技能</Radio>
            </Radio.Group>
            {value.mode === 'allowlist' && (
                <div style={{paddingLeft: 4}}>
                    {skillOptions.length === 0 ? (
                        <span style={{color: '#999', fontSize: 12}}>
                            暂无可用技能，请先到技能管理添加
                        </span>
                    ) : (
                        <Checkbox.Group
                            value={value.skills}
                            onChange={checked => set({skills: checked as string[]})}
                            options={skillOptions.map(s => ({
                                label: (
                                    <>
                                        <code>{s.name}</code>
                                        <span style={{color: '#888', fontSize: 12, marginLeft: 6}}>
                                            {s.description}
                                        </span>
                                    </>
                                ),
                                value: s.name,
                            }))}
                            style={{display: 'flex', flexDirection: 'column', gap: 4}}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default SkillsField;
