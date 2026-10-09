import type { ReactNode } from "react";

/** 表单分区标题（左侧色条 + 说明文案） */
export const FormSec = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) => (
  <section className="form-sec">
    <header className="form-sec__head">
      <h3 className="form-sec__title">{title}</h3>
      {hint ? <p className="form-sec__hint">{hint}</p> : null}
    </header>
    {children ? <div className="form-sec__body">{children}</div> : null}
  </section>
);

export default FormSec;
