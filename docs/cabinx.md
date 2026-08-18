# CabinX 组件使用文档

CabinX 是项目内置的通用 CRUD 页面组件，封装了搜索栏、数据表格、新增/编辑 Drawer/Modal 三个区域，业务侧只需声明 `columns` 和 `api`，无需手写表格和表单逻辑。

---

## 快速上手

```tsx
import CabinX, { type CabinXColumn } from '@/components/CabinX'
import { invoke } from '@/hooks/useTauri'
import { useMemo, useState } from 'react'

interface Item {
  id: string
  name: string
  enabled: boolean
}

export const MyPage = () => {
  const [refreshKey, setRefreshKey] = useState(0)

  const api = useMemo(() => ({
    paging: async (params: any) => {
      void refreshKey
      const list = await invoke<Item[]>('item_list')
      return { list, total: list.length, pageNum: 1, pageSize: list.length }
    },
    add:  (data: any) => invoke('item_add', data),
    edit: (data: any) => invoke('item_update', data),
    del:  (id: string | number) => invoke('item_remove', { id: String(id) }),
  }), [refreshKey])

  const columns: CabinXColumn<Item>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      search: { name: 'name', label: '关键词', type: 'input', placeholder: '搜索名称…' },
      editor: { name: 'name', label: '名称', type: 'input', rules: [{ required: true }] },
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v: boolean) => v ? <span className="model-badge">启用</span> : <span>停用</span>,
    },
  ]

  return (
    <div className="page page-scroll">
      <CabinX
        api={api}
        columns={columns}
        pageTitle="示例管理"
        rowKey="id"
      />
    </div>
  )
}
```

---

## Props 说明

| Prop | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `api` | `ApiObject` | 必填 | 数据操作对象，见下方详解 |
| `columns` | `CabinXColumn[]` | 必填 | 列配置，同时驱动表格、搜索栏和编辑表单 |
| `pageTitle` | `string` | `'数据管理'` | 页面顶部标题 |
| `rowKey` | `string` | `'id'` | 表格行唯一键字段名 |
| `formType` | `'D' \| 'M'` | `'D'` | 编辑器形式：D = Drawer（右侧抽屉），M = Modal |
| `editorWidth` | `number` | `500` | Drawer/Modal 宽度（px） |
| `editorTitle` | `string` | — | 编辑器标题后缀（显示为"编辑XXX"/"新增XXX"） |
| `formatRecordForEdit` | `(record) => any` | 默认转换 | 点击编辑时将 record 转为表单初始值 |
| `beforeSubmit` | `(values) => any` | — | 提交前对表单值做转换，返回值作为实际 payload |
| `filterEditorFields` | `(fields, currentItem) => fields` | — | 动态过滤/修改表单字段（如编辑时某字段只读） |
| `initialSearchValues` | `Record<string, any>` | — | 搜索表单的默认值（首次加载时作为查询参数） |
| `headerActions` | `ReactNode \| null` | 默认新增按钮 | 替换顶部右侧按钮区；传 `null` 隐藏所有按钮 |
| `extraHeaderActions` | `ReactNode` | — | 在默认新增按钮之前插入额外按钮 |
| `showActionColumn` | `boolean` | `true` | 是否显示操作列（编辑/删除） |
| `actionColumnWidth` | `number` | `200` | 操作列宽度 |
| `actionBtnComponents` | `(record) => ReactNode` | — | 在操作列内追加自定义按钮 |

---

## api 对象

```ts
api: {
  paging:  (params) => Promise<{ list: T[]; total: number; pageNum: number; pageSize: number }>
  add?:    (data)   => Promise<any>
  edit?:   (data)   => Promise<any>
  del?:    (id)     => Promise<any>
  enable?: (id, enabled) => Promise<any>   // 可选，供 Action 组件使用
}
```

`paging` 接收搜索表单的所有字段值 + `pageNum` + `pageSize` + 排序参数（`sortField` / `sortOrder`）。

> **注意**：`api` 对象建议用 `useMemo` 包裹，避免每次渲染都重新触发数据请求。

---

## CabinXColumn 详解

每一列可以同时配置三个角色：

| 属性 | 作用 |
|---|---|
| 列本身（`title` / `dataIndex` / `render` 等） | 控制表格显示 |
| `search` | 声明该列在搜索栏中的表单项 |
| `editor` | 声明该列在新增/编辑表单中的表单项 |
| `hideInTable` | `true` 时该列不出现在表格，仅用于表单（常见于纯表单字段） |

### search / editor 字段类型（FormField）

```ts
interface FormField {
  name?:        string               // 表单字段名，默认取 dataIndex
  label?:       string               // 表单标签，默认取 title
  type:         'input' | 'textarea' | 'select' | 'switch' | 'datepicker'
  rules?:       AntdRule[]           // antd 校验规则
  placeholder?: string
  options?:     { label: string; value: string | number }[]  // type='select' 时
  asyncOptions?: () => Promise<{ label: string; value: string | number }[]>
  multiple?:    boolean              // select 多选
  initialValue?: any                 // 字段初始值
  rows?:        number               // textarea 行数，默认 6
  valuePropName?: string             // 如 switch 用 'checked'
  hide?:        [boolean, boolean, boolean]  // [新增时隐藏, 编辑时隐藏, 查看时隐藏]
  order?:       number               // 表单字段排序（数字越小越靠前）
  renderFormItem?: (form) => ReactNode  // 完全自定义渲染，form 为 antd Form 实例
}
```

---

## 常见模式

### 1. 仅表单不在表格显示的字段

```tsx
{
  title: '密钥',
  dataIndex: '__api_key',   // dataIndex 随意，hideInTable 后不展示
  key: '__api_key',
  hideInTable: true,
  editor: {
    name: 'api_key',
    label: 'API 密钥',
    type: 'input',
    placeholder: 'sk-...',
  },
},
```

### 2. 用 Tag 展示枚举值

适合 tier、状态、类型等有限枚举字段，直接在列的 `render` 中使用 antd `Tag`：

```tsx
import { Tag } from 'antd'

{
  title: '类型',
  dataIndex: 'tier',
  key: 'tier',
  render: (tier: string) => (
    <Tag color={tier === 'cloud' ? 'blue' : 'orange'}>
      {tier === 'cloud' ? '云端' : '本地'}
    </Tag>
  ),
},
```

常用 Tag 颜色：

| 颜色值 | 适用场景 |
|---|---|
| `blue` | 云端、主要类型 |
| `orange` | 本地、次要类型 |
| `green` | 成功、已连接 |
| `red` | 错误、禁用 |
| `default` | 中性状态 |
| `processing` | 处理中、运行中 |

---

### 3. 用 Switch 展示布尔状态

表格中展示 enabled 等布尔字段时，用 antd `Switch` 纯展示（加 `pointerEvents: none` 防止误触）：

```tsx
import { Switch } from 'antd'

{
  title: '状态',
  dataIndex: 'enabled',
  key: 'enabled',
  render: (enabled: boolean) => (
    <Switch size="small" checked={enabled} style={{ pointerEvents: 'none' }} />
  ),
},
```

表单中的 Switch（可交互，用于新增/编辑）配置在 `editor` 字段，见下方"编辑时显示、新增时隐藏"示例。

---

### 4. 编辑时显示、新增时隐藏

```tsx
editor: {
  name: 'enabled',
  label: '启用',
  type: 'switch',
  valuePropName: 'checked',
  initialValue: true,
  hide: [true, false, false],   // 新增隐藏，编辑/查看显示
  checkedChildren: '启用',
  unCheckedChildren: '停用',
},
```

### 3. 下拉联动（renderFormItem）

当选择某个值时自动填充其他字段，通过 `renderFormItem` 拿到 `form` 实例：

```tsx
{
  title: '类型',
  dataIndex: '__tier',
  key: '__tier',
  hideInTable: true,
  editor: {
    name: 'tier',
    label: '类型',
    type: 'input',            // type 此时无实际作用，被 renderFormItem 覆盖
    renderFormItem: (form) => (
      <Select
        options={[
          { value: 'cloud', label: '云端' },
          { value: 'local', label: '本地' },
        ]}
        onChange={(v) => {
          if (v === 'local') {
            form.setFieldsValue({
              kind: 'openai',
              base_url: 'http://localhost:11434/v1',
            })
          }
        }}
      />
    ),
  },
},
```

### 4. 自定义渲染（antd 组件，如 InputNumber）

```tsx
{
  title: 'Context 窗口',
  dataIndex: '__ctx',
  key: '__ctx',
  hideInTable: true,
  editor: {
    name: 'context_window',
    label: 'Context 窗口',
    type: 'input',
    renderFormItem: () => (
      <Form.Item name="context_window" noStyle>
        <InputNumber min={1024} max={2000000} style={{ width: '100%' }} />
      </Form.Item>
    ),
  },
},
```

> 使用 `renderFormItem` 渲染自定义组件时，若要让 CabinX 正确收集值，将 `Form.Item name="字段名" noStyle` 包在最外层。

### 5. 编辑时某字段只读（filterEditorFields）

```tsx
<CabinX
  filterEditorFields={(fields, currentItem) => {
    if (!currentItem) return fields   // 新增时不修改
    return fields.map(f =>
      f.name === 'name'
        ? { ...f, renderFormItem: () => <Input disabled /> }
        : f
    )
  }}
/>
```

### 6. 提交前转换数据（beforeSubmit）

```tsx
<CabinX
  beforeSubmit={(values) => ({
    ...values,
    args: values.args?.split(' ').filter(Boolean) ?? [],
    enabled: values.enabled ?? true,
  })}
/>
```

### 7. 编辑时注入 id（formatRecordForEdit）

当后端 edit 命令需要 `id` 但不想在表格里显示时：

```tsx
<CabinX
  formatRecordForEdit={(record) => ({
    id: record.id,           // 注入 id，CabinX 提交时会带上
    name: record.name,
    enabled: record.enabled,
  })}
/>
```

### 8. 刷新列表（refreshKey 模式）

```tsx
const [refreshKey, setRefreshKey] = useState(0)

const api = useMemo(() => ({
  paging: async () => {
    void refreshKey           // 依赖 refreshKey，变化时重新请求
    const list = await invoke('item_list')
    return { list, total: list.length, pageNum: 1, pageSize: list.length }
  },
  // ...
}), [refreshKey])

// 手动触发刷新
<Button onClick={() => setRefreshKey(k => k + 1)}>刷新</Button>
```

### 9. 顶部自定义按钮

```tsx
// 替换默认新增按钮
<CabinX headerActions={<Button onClick={handleCustomAdd}>自定义新增</Button>} />

// 隐藏所有按钮
<CabinX headerActions={null} />

// 在新增按钮前插入额外按钮
<CabinX
  extraHeaderActions={<Button onClick={handleExport}>导出</Button>}
/>
```

### 10. 操作列自定义按钮

```tsx
<CabinX
  actionBtnComponents={(record) => (
    <Button size="small" onClick={() => handleConnect(record.name)}>
      连接
    </Button>
  )}
/>
```

---

## 搜索栏

列上有 `search` 字段时，CabinX 自动在表格上方渲染搜索栏。搜索参数会作为 `paging(params)` 的参数传入。

```tsx
search: {
  name: 'status',
  label: '状态',
  type: 'select',
  options: [
    { label: '全部', value: 'all' },
    { label: '启用', value: '1' },
    { label: '停用', value: '0' },
  ],
  placeholder: '全部状态',
},
```

设置搜索栏初始值：

```tsx
<CabinX initialSearchValues={{ status: 'all' }} />
```

---

## 字段排序

表单字段默认按列定义顺序显示，用 `order` 属性手动调整：

```tsx
editor: { name: 'name', label: '名称', type: 'input', order: 1 },
editor: { name: 'kind', label: '协议', type: 'select', order: 2 },
```

---

## 实际使用示例

项目中已有的 CabinX 页面（可作为参考）：

| 页面 | 文件路径 | 特点 |
|---|---|---|
| MCP 服务器 | `src/views/mcp/index.tsx` | 预设联动、操作列自定义按钮、filterEditorFields |
| 技能包 | `src/views/skills/index.tsx` | asyncOptions、switch 字段 |
| 模型配置 | `src/views/models/index.tsx` | tier 联动、InputNumber、hide 按模式显示 |
| 账户管理 | `src/views/accounts/index.tsx` | Vault 加密、自定义 headerActions |
| 媒体平台 | `src/views/media-platforms/index.tsx` | 嵌套字段、分组显示 |
