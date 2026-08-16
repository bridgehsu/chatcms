import React from 'react';
import { Badge, Button, Checkbox, Radio, Space, Tag } from 'antd';
import type { Skill } from '@/types';

export type SkillsConfig = { mode: 'all' | 'none' | 'allowlist'; skills: string[] };

const SkillsField: React.FC<{
    value?: SkillsConfig;
    onChange?: (v: SkillsConfig) => void;
    skillOptions: Skill[];
}> = ({value = {mode: 'all', skills: []}, onChange, skillOptions}) => {
    const set = (patch: Partial<SkillsConfig>) => onChange?.({...value, ...patch});

    const allNames = skillOptions.map(s => s.name);
    const selectedCount = value.skills.length;
    const isAllSelected = allNames.length > 0 && selectedCount === allNames.length;

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
                <Radio.Button value="allowlist">
                    指定白名单
                    {value.mode === 'allowlist' && selectedCount > 0 && (
                        <Badge
                            count={selectedCount}
                            size="small"
                            style={{marginLeft: 5, boxShadow: 'none', backgroundColor: 'rgba(255,255,255,0.35)'}}
                        />
                    )}
                </Radio.Button>
                <Radio.Button value="none">不使用</Radio.Button>
            </Radio.Group>

            {value.mode === 'allowlist' && (
                <div style={{
                    borderRadius: 6,
                    border: '1px solid var(--ant-color-border, #d9d9d9)',
                    background: 'var(--ant-color-fill-quaternary, #fafafa)',
                    overflow: 'hidden',
                }}>
                    {/* 全选 / 清空 操作栏 */}
                    {skillOptions.length > 0 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '5px 10px',
                            borderBottom: '1px solid var(--ant-color-border, #d9d9d9)',
                            background: 'var(--ant-color-fill-tertiary, #f0f0f0)',
                        }}>
                            <span style={{fontSize: 12, color: 'var(--ant-color-text-secondary)'}}>
                                {selectedCount > 0 ? `已选 ${selectedCount} / ${allNames.length}` : '未选择'}
                            </span>
                            <Space size={4}>
                                <Button type="link" size="small" style={{padding: 0, height: 'auto', fontSize: 12}}
                                        onClick={() => set({skills: allNames})}
                                        disabled={isAllSelected}>
                                    全选
                                </Button>
                                <Button type="link" size="small" style={{padding: 0, height: 'auto', fontSize: 12}}
                                        onClick={() => set({skills: []})}
                                        disabled={selectedCount === 0}>
                                    清空
                                </Button>
                            </Space>
                        </div>
                    )}

                    {/* 技能列表 */}
                    <div style={{padding: '8px 10px', maxHeight: 200, overflowY: 'auto'}}>
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
                                        <span style={{color: '#888', fontSize: 12, marginLeft: 4}}>
                                            {s.description}
                                        </span>
                                    </Checkbox>
                                ))}
                            </Checkbox.Group>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SkillsField;
