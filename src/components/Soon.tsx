interface Props {
  title: string;
  description: string;
}

/** 未实现功能的占位页 */
export const PlaceholderPage = ({ title, description }: Props) => (
  <div className="page page-placeholder">
    <h1 className="page-title">{title}</h1>
    <p className="page-desc">{description}</p>
  </div>
);
