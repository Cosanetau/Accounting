import { useState } from 'react';
import { openAccountingAttachment } from '../utils/attachments';

export default function AttachmentLink({ path, filename }) {
  const [isOpening, setIsOpening] = useState(false);

  if (!path || !filename) {
    return '—';
  }

  async function handleOpen() {
    setIsOpening(true);

    try {
      await openAccountingAttachment(path);
    } catch (error) {
      window.alert(error.message || 'Could not open attachment.');
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <button
      className="attachment-link"
      disabled={isOpening}
      type="button"
      onClick={() => void handleOpen()}
    >
      {isOpening ? 'Opening...' : filename}
    </button>
  );
}
