import { Pencil, Trash2 } from 'lucide-react';

export default function RecordActions({ canEdit, onEdit, onDelete }) {
  if (!canEdit) {
    return null;
  }

  return (
    <div className="record-actions">
      <button className="icon-action" title="Edit" type="button" onClick={onEdit}>
        <Pencil size={15} />
      </button>
      <button className="icon-action is-danger" title="Delete" type="button" onClick={onDelete}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}
