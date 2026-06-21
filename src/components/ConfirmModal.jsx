export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isBusy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="accounting-modal-backdrop" onClick={onCancel}>
      <div
        className="accounting-modal accounting-confirm-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <p>{message}</p>
        </header>

        <div className="accounting-modal-actions">
          <button className="secondary-action" disabled={isBusy} type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="danger-action" disabled={isBusy} type="button" onClick={onConfirm}>
            {isBusy ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
