import React, {useEffect, useState} from 'react';
import {Button, Drawer, Form, Modal, Spin} from 'antd';
import {DformProps} from '@/components/CabinX/index';
import {DatePicker, Input, Select, Switch} from 'antd';
import type {FormField} from './types';

// DformProps 类型已集中至 index.d.ts

// 渲染表单字段（内联实现）

const AsyncSelectField: React.FC<{ field: FormField; value?: any; onChange?: (v: any) => void }> = ({
  field,
  value,
  onChange,
}) => {
  const [options, setOptions] = useState<{ label: string; value: string | number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (field.asyncOptions) {
      setLoading(true);
      field
        .asyncOptions()
        .then((data) => setOptions(data))
        .catch((err) => console.error('加载选项失败:', err))
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
      notFoundContent={loading ? <Spin size="small" /> : null}
      value={value}
      onChange={(...args) => onChange?.(args[0])}
    />
  );
};

const renderFormField = (field: FormField, form: any) => {
  if (field.renderFormItem) {
    return (
      <Form.Item
        key={field.name}
        label={field.label}
        name={field.name}
        rules={field.rules}
        valuePropName={field.valuePropName || 'value'}
        getValueFromEvent={field.getValueFromEvent}
        initialValue={field.initialValue}
      >
        {field.renderFormItem(form)}
      </Form.Item>
    );
  }

  let component: React.ReactNode;
  switch (field.type) {
    case 'input':
      component = <Input placeholder={field.placeholder} />;
      break;
    case 'textarea':
      component = <Input.TextArea rows={field.rows || 6} placeholder={field.placeholder} />;
      break;
    case 'select':
      if (field.asyncOptions) {
        component = <AsyncSelectField field={field} />;
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
      component = (
        <Switch checkedChildren={field.checkedChildren} unCheckedChildren={field.unCheckedChildren} />
      );
      break;
    case 'datepicker':
      component = <DatePicker style={{ width: '100%' }} placeholder={field.placeholder} />;
      break;
    default:
      component = <Input placeholder={field.placeholder} />;
  }

  return (
    <Form.Item
      key={field.name}
      label={field.label}
      name={field.name}
      rules={field.rules}
      valuePropName={field.valuePropName || 'value'}
      getValueFromEvent={field.getValueFromEvent}
      initialValue={field.initialValue}
    >
      {component}
    </Form.Item>
  );
};

const Editor: React.FC<DformProps> = ({
                                          title,
                                          size = 'default',
                                          open,
                                          onClose,
                                          onSubmit,
                                          formFields,
                                          loading,
                                          form,
                                          type = 'D',
                                          width = 500,
                                          readOnly = false,
                                      }) => {
    const handleFinishFailed = (errorInfo: any) => {
        console.log('表单校验失败:', errorInfo);
        const roleIdsError = errorInfo.errorFields.find((field: any) => field.name.includes('roleIds'));
        if (roleIdsError) {
            console.log('roleIds字段验证错误:', roleIdsError.errors);
        }
    };

    const formContent = (
        <Form
            form={form}
            layout="vertical"
            onFinish={onSubmit}
            onFinishFailed={handleFinishFailed}
            autoComplete="off"
            disabled={readOnly}
        >
            {formFields.map((field) => renderFormField(field, form))}
        </Form>
    );

    const submitButton = !readOnly && (
        <Button type="primary" onClick={form.submit} loading={loading}>
            提交
        </Button>
    );

    if (type === 'D') {
        return (
            <Drawer title={title} onClose={onClose} open={open} extra={submitButton} width={width} closable={false}>
                {formContent}
            </Drawer>
        );
    } else {
        return (
            <Modal
                title={title}
                open={open}
                onCancel={onClose}
                closable={false}
                footer={readOnly
                    ? [<Button key="close" onClick={onClose}>关闭</Button>]
                    : [<Button key="cancel" onClick={onClose}>取消</Button>, submitButton]
                }
                width={width}
            >
                {formContent}
            </Modal>
        );
    }
};

export default Editor;
