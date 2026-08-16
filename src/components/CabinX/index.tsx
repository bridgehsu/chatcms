import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {App as AntdApp, Button, Card, DatePicker, Form, Input, Select, Spin, Switch, Table} from 'antd';
import Action from './Action';
import Search from './Search';
// 类型定义从本地 types.ts 导入，避免自引用
import type {CabinXColumn, CabinXProps, FormField, FormFieldType} from './types';
// 透出类型，便于从 '@/components/CabinX' 或 '@/components/CabinX/index' 处按需导入
export type {
    CabinXColumn,
    CabinXProps,
    FormField,
    FormFieldType,
    DformProps,
    CabinXItem,
    CabinXParameters,
    ActionHandlers,
} from './types';
import Editor from "./Editor.tsx";

// 默认的单元格渲染：
// - 当值为数组时，拼接多个 label/name/title/value
// - 当值为对象时，优先取 label/name/title/value
// - 其他情况按字符串输出，空值使用 '-'
const defaultRenderCell = (value: any): React.ReactNode => {
    if (Array.isArray(value)) {
        if (value.length === 0) return '-';
        const labels = value
            .map((v: any) => {
                if (v == null) return '';
                if (typeof v === 'string' || typeof v === 'number') return String(v);
                return v.label ?? v.name ?? v.title ?? String(v.value ?? '');
            })
            .filter(Boolean);
        return labels.join('、');
    }
    if (value == null || value === '') return '-';
    if (typeof value === 'object') return value.label ?? value.name ?? value.title ?? String(value.value ?? '');
    return String(value);
};

// 支持异步下拉选项的通用选择器（用于搜索表单）
const AsyncSelectField: React.FC<{ field: FormField; value?: any; onChange?: (v: any) => void }> = ({
                                                                                                        field,
                                                                                                        value,
                                                                                                        onChange
                                                                                                    }) => {
    const [options, setOptions] = useState<{ label: string; value: string | number }[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (field.asyncOptions) {
            setLoading(true);
            field.asyncOptions()
                .then(data => setOptions(data))
                .catch(err => console.error('加载选项失败:', err))
                .finally(() => setLoading(false));
        }
    }, [field.asyncOptions]);

    return (
        <Select
            placeholder={field.placeholder}
            options={options}
            mode={field.multiple ? 'multiple' : undefined}
            allowClear
            showSearch
            optionFilterProp="label"
            notFoundContent={loading ? <Spin size="small"/> : null}
            value={value}
            onChange={(...args) => onChange?.(args[0])}
        />
    );
};

const renderFormField = (field: FormField) => {
    let component;
    switch (field.type) {
        case 'input':
            component = <Input placeholder={field.placeholder}/>;
            break;
        case 'textarea':
            component = <Input.TextArea rows={field.rows || 6} placeholder={field.placeholder}/>;
            break;
        case 'select':
            if (field.asyncOptions) {
                component = <AsyncSelectField field={field}/>;
            } else {
                component = (
                    <Select
                        placeholder={field.placeholder}
                        options={field.options}
                        mode={field.multiple ? 'multiple' : undefined}
                        allowClear
                        showSearch
                        optionFilterProp="label"
                    />
                );
            }
            break;
        case 'switch':
            component = <Switch checkedChildren={field.checkedChildren} unCheckedChildren={field.unCheckedChildren}/>;
            break;
        case 'datepicker':
            component = <DatePicker showTime format="YYYY-MM-DD HH:mm:ss"/>;
            break;
        default:
            return null;
    }

    return (
        <Form.Item
            key={field.name}
            label={field.label}
            name={field.name}
            rules={field.rules}
            valuePropName={field.valuePropName}
            initialValue={field.initialValue}
        >
            {component}
        </Form.Item>
    );
};

/**
 * Default formatRecordForEdit implementation that handles common patterns:
 * - Converts state field from 1/0 to boolean true/false
 */
const defaultFormatRecordForEdit = (record: any) => {
    const formattedRecord = {...record};
    if ('state' in record && (record.state === 1 || record.state === 0)) {
        formattedRecord.state = record.state === 1;
    }
    return formattedRecord;
};

const CabinX: React.FC<CabinXProps> = ({
                                           api,
                                           columns,
                                           pageTitle = '数据管理',
                                           editorTitle,
                                           rowKey = 'id',
                                           formatRecordForEdit = defaultFormatRecordForEdit,
                                           filterEditorFields,
                                           beforeSubmit,
                                           drawerSize = 'default',
                                           editorWidth = 500, // 默认宽度500px
                                           showActionColumn = true,
                                           actionColumnWidth = 200,
                                           actionColumnRender,
                                           actionBtnComponents,
                                           formType = 'D',
                                           headerActions,
                                           initialSearchValues,
                                       }) => {
    const {message} = AntdApp.useApp();
    const [loading, setLoading] = useState(false);
    const [dataList, setDataList] = useState<any[]>([]);
    const [searchForm] = Form.useForm();
    const [editorForm] = Form.useForm();
    const [currentItem, setCurrentItem] = useState<any | null>(null);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [btnLoading, setBtnLoading] = useState<boolean>(false);
    // 添加排序状态
    const [sorterState, setSorterState] = useState<{ field?: string; order?: string }>({});
    const [pagination, setPagination] = useState({pageNum: 1, pageSize: 10, total: 0});

    const {searchFormFields, editorFormFields, tableColumns} = useMemo(() => {
        // 创建带有原始索引的字段数组，用于排序
        const searchFieldsWithIndex: Array<FormField & { order?: number, originalIndex: number }> = [];
        const editFieldsWithIndex: Array<FormField & { order?: number, originalIndex: number }> = [];
        const tableColsWithIndex: Array<CabinXColumn<any> & { order?: number, originalIndex: number }> = [];

        // 首先收集所有字段，保存原始索引和排序值
        columns.forEach((col, index) => {
            const {search, editor, hideInTable, tableOrder, ...restCol} = col;

            if (search) {
                let field;
                if (typeof search === 'boolean') {
                    // 如果 search 为 boolean，使用 title 和 dataIndex 作为默认值
                    field = {
                        name: restCol.dataIndex as string,
                        label: restCol.title as string,
                        type: 'input' as FormFieldType
                    };
                } else {
                    // 如果 search 是对象，但没有指定 name 或 label，使用 title 和 dataIndex 作为默认值
                    field = {
                        ...search,
                        name: search.name || restCol.dataIndex as string,
                        label: search.label || restCol.title as string
                    };
                }
                searchFieldsWithIndex.push({
                    ...field as FormField,
                    order: typeof search === 'boolean' ? undefined : search.order,
                    originalIndex: index
                });
            }

            if (editor) {
                let field;
                if (typeof editor === 'boolean') {
                    // 如果 editor 为 boolean，使用 title 和 dataIndex 作为默认值
                    field = {
                        name: restCol.dataIndex as string,
                        label: restCol.title as string,
                        type: 'input' as FormFieldType
                    };
                } else {
                    // 如果 editor 是对象，但没有指定 name 或 label，使用 title 和 dataIndex 作为默认值
                    field = {
                        ...editor,
                        name: editor.name || restCol.dataIndex as string,
                        label: editor.label || restCol.title as string
                    };
                }
                editFieldsWithIndex.push({
                    ...field as FormField,
                    order: typeof editor === 'boolean' ? undefined : editor.order,
                    originalIndex: index
                });
            }

            // 隐藏主键列（rowKey）以避免业务侧配置，默认不展示
            const isPrimaryKeyCol = String(restCol.dataIndex) === String(rowKey);
            if (!hideInTable && !isPrimaryKeyCol) {
                tableColsWithIndex.push({
                    ...restCol,
                    order: tableOrder,
                    originalIndex: index
                });
            }
        });

        // 排序函数：先按指定的order排序，如果没有指定则按原始索引排序
        const sortByOrderOrIndex = <T extends { order?: number, originalIndex: number }>(a: T, b: T) => {
            // 如果两者都有order，则按order排序
            if (a.order !== undefined && b.order !== undefined) {
                return a.order - b.order;
            }
            // 如果只有一个有order，有order的排前面
            if (a.order !== undefined) return -1;
            if (b.order !== undefined) return 1;
            // 如果都没有order，则按原始索引排序
            return a.originalIndex - b.originalIndex;
        };

        // 排序并删除辅助属性
        const searchFields = searchFieldsWithIndex.sort(sortByOrderOrIndex).map(({
                                                                                     order,
                                                                                     originalIndex,
                                                                                     ...field
                                                                                 }) => field);
        const editorFields = editFieldsWithIndex.sort(sortByOrderOrIndex).map(({
                                                                                   order,
                                                                                   originalIndex,
                                                                                   ...field
                                                                               }) => field);
        const tableCols = tableColsWithIndex.sort(sortByOrderOrIndex).map(({order, originalIndex, ...col}) => col);

        return {searchFormFields: searchFields, editorFormFields: editorFields, tableColumns: tableCols};
    }, [columns]);

    // 通用字典映射：仅根据列的 editor 配置（select/options 或 asyncOptions）自动建立 id->label 的映射
    const [dictMap, setDictMap] = useState<Record<string, Record<string | number, string>>>({});

    useEffect(() => {
        const load = async () => {
            const nextDict: Record<string, Record<string | number, string>> = {};
            // 从列中识别需要的字典字段（仅使用 editor 配置）
            for (const col of columns) {
                const dataIndex = col.dataIndex as string;
                if (!dataIndex) continue;
                const cfg = (typeof col.editor === 'object' ? col.editor : undefined);
                if (!cfg || cfg.type !== 'select') continue;
                if (cfg.options && Array.isArray(cfg.options)) {
                    nextDict[dataIndex] = cfg.options.reduce((acc: any, cur: any) => {
                        acc[cur.value] = cur.label;
                        return acc;
                    }, {} as Record<string | number, string>);
                } else if (cfg.asyncOptions) {
                    try {
                        const opts = await cfg.asyncOptions();
                        nextDict[dataIndex] = opts.reduce((acc: any, cur: any) => {
                            acc[cur.value] = cur.label;
                            return acc;
                        }, {} as Record<string | number, string>);
                    } catch (e) {
                        // 忽略单个字典加载失败
                    }
                }
            }
            setDictMap(nextDict);
        };
        void load();
    }, [columns]);

    const fetchData = useCallback(async (formValues: any = {}, pageNum = 1, pageSize = 10, sortField?: string, sortOrder?: string) => {
        setLoading(true);
        try {
            const params = {...formValues, pageNum, pageSize};

            // 添加排序参数
            if (sortField && sortOrder) {
                params.sortField = sortField;
                params.sortOrder = sortOrder;
            }
            const result = await api.paging(params);

            // IPC 直接返回数据，无 { data } 包装
            const list = Array.isArray(result?.list) ? result.list : [];

            setDataList(list);
            setPagination(prev => ({
                ...prev,
                total: result?.total || 0,
                pageNum: result?.pageNum || pageNum,
                pageSize: result?.pageSize || pageSize
            }));
        } catch (error) {
            message.error('数据加载失败');
        } finally {
            setLoading(false);
        }
    }, [api.paging]);

    useEffect(() => {
        if (initialSearchValues) {
            searchForm.setFieldsValue(initialSearchValues);
        }
    }, []);

    useEffect(() => {
        // 统一由 effect 负责在排序或分页变化时拉取数据
        const formValues = searchForm.getFieldsValue();
        fetchData(formValues, pagination.pageNum, pagination.pageSize, sorterState.field, sorterState.order).then(() => {
        });
    }, [fetchData, sorterState.field, sorterState.order, pagination.pageNum, pagination.pageSize]);

    const handleDelete = async (id: number | string) => {
        try {
            await api.del(id);
            await fetchData(searchForm.getFieldsValue(), pagination.pageNum, pagination.pageSize, sorterState.field, sorterState.order);
        } catch {
            message.error('删除失败');
        }
    };

    const onSearch = async (values: any) => {
        await fetchData(values, 1, pagination.pageSize, sorterState.field, sorterState.order);
    };

    const onResetSearch = async () => {
        searchForm.resetFields();
        if (initialSearchValues) {
            searchForm.setFieldsValue(initialSearchValues);
        }
        await fetchData(initialSearchValues ?? {}, 1, pagination.pageSize, sorterState.field, sorterState.order);
    };

    const handleAdd = () => {
        setCurrentItem(null);
        editorForm.resetFields();
        setDrawerVisible(true);
    };

    const handleEdit = useCallback((record: any) => {
        // Apply the formatRecordForEdit function (either custom or default)
        const formattedRecord = formatRecordForEdit(record);

        setCurrentItem(record);
        editorForm.setFieldsValue(formattedRecord);
        setDrawerVisible(true);
    }, [editorForm, formatRecordForEdit]);

    // 关闭抽屉并重置表单
    const closeDrawerAndResetForm = () => {
        setCurrentItem(null);
        editorForm.resetFields();
        setDrawerVisible(false);
    };

    const handleSubmit = async (values: any) => {
        // 允许上层在提交前对表单值做转换，保持 CabinX 通用
        const payload = beforeSubmit ? beforeSubmit(values) : values;
        setBtnLoading(true);
        try {
            if (currentItem) {
                await api.edit({...payload, id: currentItem[rowKey]});
                message.success('编辑成功');
            } else {
                await api.add(payload);
                message.success('添加成功');
            }
            setDrawerVisible(false);
            editorForm.resetFields();
            await fetchData(searchForm.getFieldsValue(), pagination.pageNum, pagination.pageSize, sorterState.field, sorterState.order);
        } catch (err: any) {
            message.error(err.message || '操作失败');
        } finally {
            setBtnLoading(false);
        }
    };

    const handleTableChange = (pag: any, _filters: any, sorter: any) => {
        // 处理排序
        let sortField = undefined;
        let sortOrder = undefined;

        if (sorter && sorter.field) {
            sortField = sorter.field;
            sortOrder = sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : undefined;
            // 更新排序状态
            setSorterState({field: sortField, order: sortOrder});
        }

        // 更新分页，实际请求交由 useEffect 统一处理
        setPagination(prev => ({
            ...prev,
            pageNum: pag?.current ?? prev.pageNum,
            pageSize: pag?.pageSize ?? prev.pageSize,
        }));
    };

    const memoizedColumns = useMemo(() => {
        const baseColumns = [...tableColumns].map(column => {
            // 此处不需要为列添加排序配置，仅补充默认渲染
            if (column.dataIndex && column.key !== 'action') {
                const enhanced = {
                    align: 'center',
                    ...column,
                } as any;
                if (!enhanced.render) {
                    const fieldName = String(enhanced.dataIndex);
                    if (dictMap[fieldName]) {
                        enhanced.render = (value: any) => {
                            const mapped = dictMap[fieldName]?.[value as any];
                            return mapped ?? defaultRenderCell(value);
                        };
                    } else {
                        enhanced.render = (value: any) => defaultRenderCell(value);
                    }
                }
                return enhanced;
            }
            return column;
        });

        baseColumns.unshift({
            title: '序号',
            dataIndex: 'no',
            key: 'no',
            align: 'center',
            width: 80,
            fixed: 'left',
            render: (_: any, __: any, index: number) => (pagination.pageNum - 1) * pagination.pageSize + index + 1
        } as any);

        if (showActionColumn) {
            baseColumns.push({
                title: '操作',
                key: 'action',
                fixed: 'right',
                align: 'center',
                width: actionColumnWidth,
                render: (_: any, record: any) => (
                    <Action
                        record={record}
                        rowKey={rowKey}
                        api={api}
                        handleEdit={handleEdit}
                        handleDelete={handleDelete}
                        fetchData={fetchData}
                        searchFormValues={searchForm.getFieldsValue()}
                        pagination={pagination}
                        actionBtnComponents={actionBtnComponents}
                    />
                )
            });
        }

        return baseColumns;
    }, [
        tableColumns,
        showActionColumn,
        actionColumnWidth,
        actionColumnRender,
        handleEdit,
        handleDelete,
        rowKey,
        dictMap,
        pagination.pageNum,
        pagination.pageSize,
    ]);

    const resolvedEditorFormFields = useMemo(() => {
        const isAdd = currentItem === null;
        const base = editorFormFields.filter(f =>
            isAdd ? !f.hide?.[0] : !f.hide?.[1]
        );
        return filterEditorFields ? filterEditorFields(base, currentItem) : base;
    }, [editorFormFields, filterEditorFields, currentItem]);

    return (
        <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
            {/* Topbar：突破 .page padding，贴顶全宽 */}
            <header className="topbar" style={{margin: '-24px -10px 0'}}>
                <div className="topbar-text">
                    <h1 className="topbar-title">{pageTitle}</h1>
                </div>
                <div className="topbar-actions">
                    {headerActions === undefined ? (
                        <Button type="primary" onClick={handleAdd}>新增</Button>
                    ) : headerActions}
                </div>
            </header>

            {/* 搜索栏 + 表格区，统一加回 padding */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0', flex: 1, minHeight: 0}}>
            {searchFormFields.length > 0 && (
                <Card size="small" styles={{body: {padding: '10px 16px'}}}>
                    <Search
                        searchForm={searchForm}
                        searchFormFields={searchFormFields}
                        onSearch={onSearch}
                        onResetSearch={onResetSearch}
                        renderFormField={renderFormField}
                    />
                </Card>
            )}

            {/* 数据表格 */}
            <Card
                size="small"
                style={{flex: 1}}
                styles={{body: {padding: 0}}}
            >
                <Table
                    rowKey={rowKey}
                    dataSource={dataList}
                    columns={memoizedColumns}
                    loading={loading}
                    size="middle"
                    scroll={{x: 'max-content'}}
                    pagination={{
                        position: ['bottomCenter'],
                        current: pagination.pageNum,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        showSizeChanger: true,
                        showTotal: (t: number) => `共 ${t} 条`,
                        size: 'small',
                    }}
                    onChange={handleTableChange}
                />
            </Card>

            <Editor
                title={(currentItem ? '编辑' : '新增') + (editorTitle ? `${editorTitle}` : '')}
                size={drawerSize}
                open={drawerVisible}
                onClose={closeDrawerAndResetForm}
                onSubmit={handleSubmit}
                formFields={resolvedEditorFormFields}
                loading={btnLoading}
                form={editorForm}
                type={formType}
                width={editorWidth}
            />
            </div>
        </div>
    );
};

export default CabinX;
