import type React from 'react';
import type { ColumnType } from 'antd/es/table';

export interface CabinXItem {
  title: string;
  dataIndex: string;
  align: string;
  search: any;
  edit: any;
}

// CabinX 通用类型定义
export type FormFieldType = 'input' | 'textarea' | 'select' | 'switch' | 'datepicker';

export interface FormField {
  label?: string;
  name?: string;
  type: FormFieldType;
  renderFormItem?: (form: any) => React.ReactNode;
  rules?: any[];
  placeholder?: string;
  options?: { label: string; value: string | number }[];
  // 异步获取选项的函数，返回Promise<options[]>格式的数据
  asyncOptions?: () => Promise<{ label: string; value: string | number }[]>;
  // 选择器是否多选（仅当 type 为 'select' 时有效）
  multiple?: boolean;
  valuePropName?: string;
  // 可选：自定义从事件中提取值的函数，用于特殊组件取值
  getValueFromEvent?: (...args: any[]) => any;
  initialValue?: any;
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;
  order?: number; // 排序属性，用于 search 和 editor 对象内
  rows?: number; // textarea 行数，默认为 6
}

// CabinX 编辑器（Drawer/Tmodal）组件的 props 类型（独立导出）
export interface DformProps {
  title: string;
  size?: 'default' | 'large';
  open: boolean;
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
  formFields: FormField[];
  loading: boolean;
  form: any;
  type?: 'D' | 'M';
  width?: number; // 自定义宽度，默认500px
}

export interface CabinXColumn<T = any> extends ColumnType<T> {
  search?: FormField | boolean;
  editor?: FormField | boolean; // 原 edit 重命名为 editor
  hideInTable?: boolean;
  tableOrder?: number; // 表格区域字段排序
}

export interface ActionHandlers {
  handleEdit: (record: any) => void;
  handleDelete: (id: number | string) => void;
}

export interface CabinXProps<T = any> {
  api: {
    paging: (params: any) => Promise<any>;
    add?: (data: any) => Promise<any>;
    edit?: (data: any) => Promise<any>;
    del?: (id: number | string) => Promise<any>;
    enable?: (id: number | string, enabled: boolean) => Promise<any>;
    enabled?: (id: number | string, enabled: boolean) => Promise<any>;
    execute?: (id: number | string) => Promise<any>;
  };
  // 自定义标题区按钮：undefined=默认新增按钮，null=不显示，ReactNode=自定义
  headerActions?: React.ReactNode | null;
  columns: CabinXColumn<T>[];
  pageTitle: string;
  editorTitle?: string; // 编辑器标题，默认为'编辑'或'新增'
  rowKey?: string;
  formatRecordForEdit?: (record: T) => any;
  filterEditorFields?: (fields: FormField[], currentItem: T | null) => FormField[];
  // 可选：提交前对表单值做统一转换，保持组件通用性
  beforeSubmit?: (values: any) => any;
  // 可选：搜索表单的默认值，首次加载时作为查询参数
  initialSearchValues?: Record<string, any>;
  drawerSize?: 'default' | 'large';
  editorWidth?: number; // 自定义Drawer/Modal宽度，默认500px
  showIdColumn?: boolean;
  showActionColumn?: boolean;
  actionColumnWidth?: number;
  actionColumnRender?: (record: T, actions: ActionHandlers) => React.ReactNode;
  actionBtnComponents?: (record: T) => React.ReactNode;
  formType?: 'D' | 'M'; // D for Drawer, M for Tmodal
}

export type CabinXParameters<T = any> = {
  api: {
    paging: (params: any) => Promise<any>;
    add?: (data: any) => Promise<any>;
    edit?: (data: any) => Promise<any>;
    del?: (id: number | string) => Promise<any>;
    enable?: (id: number | string, enabled: boolean) => Promise<any>;
    enabled?: (id: number | string, enabled: boolean) => Promise<any>;
    execute?: (id: number | string) => Promise<any>;
  };
  headerActions?: React.ReactNode | null;
  columns: CabinXColumn<T>[];
  pageTitle?: string; // default: '数据管理'
  rowKey?: string; // default: 'id'
  formatRecordForEdit?: (record: any) => any;
  filterEditorFields?: (fields: FormField[], currentItem: T | null) => FormField[];
  drawerSize?: 'default' | 'large'; // default: 'default'
  editorWidth?: number; // default: 500px (统一命名为 editorWidth)
  showIdColumn?: boolean; // default: true
  showActionColumn?: boolean; // default: true
  actionColumnWidth?: number; // default: 200
  actionColumnRender?: (record: any, actions: ActionHandlers) => React.ReactNode;
  actionBtnComponents?: (record: any) => React.ReactNode;
  formType?: 'D' | 'M'; // default: 'D' (Drawer), M for Tmodal
};
