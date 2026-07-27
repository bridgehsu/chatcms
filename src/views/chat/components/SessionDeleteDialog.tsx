type Props = {
  title: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** 删除会话确认（破坏性操作二次确认，符合主流会话产品规范） */
export const SessionDeleteDialog = ({
  title,
  busy = false,
  onCancel,
  onConfirm,
}: Props) => (
  <div className="modal-overlay" onClick={busy ? undefined : onCancel}>
    <div
      className="model-modal session-delete-dialog"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-delete-title"
    >
      <div className="model-modal__header">
        <h2 id="session-delete-title" className="model-modal__title">
          删除会话？
        </h2>
        <button
          type="button"
          className="model-modal__close"
          aria-label="关闭"
          disabled={busy}
          onClick={onCancel}
        >
          ×
        </button>
      </div>
      <div className="model-modal__body">
        <p className="session-delete-dialog__copy">
          将永久删除「<strong>{title}</strong>」及其全部消息，此操作无法撤销。
        </p>
      </div>
      <div className="model-modal__footer">
        <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "删除中…" : "删除"}
        </button>
      </div>
    </div>
  </div>
);
