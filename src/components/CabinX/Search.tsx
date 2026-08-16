import React from 'react';
import {Button, Form, Space} from 'antd';
import {FormField} from '@/components/CabinX/index';

interface SearchProps {
    searchForm: any;
    searchFormFields: FormField[];
    onSearch: (values: any) => Promise<void>;
    onResetSearch: () => Promise<void>;
    renderFormField: (field: FormField) => React.ReactNode;
}

const Search: React.FC<SearchProps> = ({
    searchForm,
    searchFormFields,
    onSearch,
    onResetSearch,
    renderFormField
}) => {
    // 移除搜索字段中的必填规则，使搜索条件可选
    const processedSearchFields = searchFormFields.map(field => {
        if (!field.rules) return field;
        
        // 创建新的规则数组，去掉required规则
        const newRules = field.rules.filter(rule => 
            typeof rule !== 'object' || !('required' in rule) || rule.required !== true
        );
        
        return {
            ...field,
            rules: newRules.length > 0 ? newRules : undefined
        };
    });

    return (
        <Form form={searchForm} layout="inline" onFinish={onSearch} autoComplete="off" className="flex-wrap gap-y-2">
            {processedSearchFields.map(renderFormField)}
            <Form.Item style={{marginBottom: 0}}>
                <Space>
                    <Button type="primary" htmlType="submit">查询</Button>
                    <Button onClick={onResetSearch}>重置</Button>
                </Space>
            </Form.Item>
        </Form>
    );
};

export default Search;
