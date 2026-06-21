import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import PeriodPicker from '../components/PeriodPicker';
import RecordActions from '../components/RecordActions';
import { useAuth } from '../lib/AuthContext';
import {
  createLogbookEntry,
  deleteLogbookEntry,
  listLogbook,
  updateLogbookEntry,
} from '../utils/accountingApi';
import { getLocalDateString, getLocalPeriod, periodFromEntryDate } from '../utils/dateLocal';

function createEmptyForm() {
  return {
    entryDate: getLocalDateString(),
    description: '',
    purpose: '',
    startLocation: '',
    endLocation: '',
    distanceKm: '',
    notes: '',
  };
}

function itemToForm(item) {
  return {
    entryDate: item.entryDate,
    description: item.description,
    purpose: item.purpose || '',
    startLocation: item.startLocation || '',
    endLocation: item.endLocation || '',
    distanceKm: item.distanceKm != null ? String(item.distanceKm) : '',
    notes: item.notes || '',
  };
}

export default function LogbookPage() {
  const { session, canEdit } = useAuth();
  const [period, setPeriod] = useState(() => getLocalPeriod());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(() => createEmptyForm());
  const [errorMessage, setErrorMessage] = useState('');
  const [modalError, setModalError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(
    async (periodOverride) => {
      if (!session?.access_token) {
        return;
      }

      const activePeriod = periodOverride || period;

      setLoading(true);
      setErrorMessage('');

      try {
        const result = await listLogbook(session.access_token, activePeriod);
        setItems(result.items || []);
      } catch (error) {
        setErrorMessage(error.message || 'Could not load log book.');
      } finally {
        setLoading(false);
      }
    },
    [session?.access_token, period],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateModal() {
    setEditingItem(null);
    setModalError('');
    setForm(createEmptyForm());
    setShowModal(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setModalError('');
    setForm(itemToForm(item));
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingItem(null);
    setModalError('');
    setForm(createEmptyForm());
  }

  async function handleSaveEntry(event) {
    event.preventDefault();

    if (!session?.access_token) {
      return;
    }

    setIsSaving(true);
    setModalError('');

    try {
      const payload = {
        ...form,
        distanceKm: form.distanceKm ? Number(form.distanceKm) : null,
      };

      let savedItem;

      if (editingItem) {
        const result = await updateLogbookEntry(session.access_token, {
          id: editingItem.id,
          ...payload,
        });
        savedItem = result.item;
      } else {
        const result = await createLogbookEntry(session.access_token, payload);
        savedItem = result.item;
      }

      const savedPeriod = periodFromEntryDate(savedItem?.entryDate || form.entryDate);
      setPeriod(savedPeriod);
      closeModal();
      await loadData(savedPeriod);
    } catch (error) {
      setModalError(error.message || 'Could not save log book entry.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!session?.access_token || !deleteTarget) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage('');

    try {
      await deleteLogbookEntry(session.access_token, deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || 'Could not delete log book entry.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="accounting-page">
      <header className="accounting-page-header">
        <div>
          <span className="accounting-kicker">Log book</span>
          <h1>Travel &amp; activity log</h1>
          <p>Keep a clean record of trips, visits, and business activity.</p>
        </div>

        <div className="accounting-header-actions">
          <PeriodPicker month={period.month} year={period.year} onChange={setPeriod} />
          {canEdit ? (
            <button className="primary-action" type="button" onClick={openCreateModal}>
              <Plus size={16} />
              Add entry
            </button>
          ) : null}
        </div>
      </header>

      {errorMessage ? <div className="accounting-error-banner">{errorMessage}</div> : null}

      <section className="accounting-table-card">
        <table className="accounting-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Purpose</th>
              <th>From</th>
              <th>To</th>
              <th>Km</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canEdit ? 7 : 6}>Loading log book...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 7 : 6}>No log book entries for this period.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.entryDate}</td>
                  <td>{item.description}</td>
                  <td>{item.purpose || '—'}</td>
                  <td>{item.startLocation || '—'}</td>
                  <td>{item.endLocation || '—'}</td>
                  <td>{item.distanceKm != null ? item.distanceKm : '—'}</td>
                  {canEdit ? (
                    <td>
                      <RecordActions
                        canEdit
                        onDelete={() => setDeleteTarget(item)}
                        onEdit={() => openEditModal(item)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {showModal ? (
        <div className="accounting-modal-backdrop">
          <form
            className="accounting-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSaveEntry}
          >
            <header>
              <h2>{editingItem ? 'Edit log book entry' : 'Add log book entry'}</h2>
              <p>Record a trip or business activity for your accountant.</p>
            </header>

            {modalError ? <div className="accounting-error">{modalError}</div> : null}

            <label>
              Date
              <input
                required
                type="date"
                value={form.entryDate}
                onChange={(event) => setForm({ ...form, entryDate: event.target.value })}
              />
            </label>
            <label>
              Description
              <input
                required
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
            <label>
              Business purpose
              <input
                value={form.purpose}
                onChange={(event) => setForm({ ...form, purpose: event.target.value })}
              />
            </label>
            <div className="accounting-form-grid">
              <label>
                From
                <input
                  value={form.startLocation}
                  onChange={(event) => setForm({ ...form, startLocation: event.target.value })}
                />
              </label>
              <label>
                To
                <input
                  value={form.endLocation}
                  onChange={(event) => setForm({ ...form, endLocation: event.target.value })}
                />
              </label>
            </div>
            <label>
              Distance (km)
              <input
                inputMode="decimal"
                value={form.distanceKm}
                onChange={(event) => setForm({ ...form, distanceKm: event.target.value })}
              />
            </label>
            <label>
              Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>

            <div className="accounting-modal-actions">
              <button className="secondary-action" type="button" onClick={closeModal}>
                Cancel
              </button>
              <button className="primary-action" disabled={isSaving} type="submit">
                {isSaving ? 'Saving...' : editingItem ? 'Save changes' : 'Save entry'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          confirmLabel="Yes, delete"
          isBusy={isDeleting}
          message={`Are you sure you want to delete "${deleteTarget.description}"? This cannot be undone.`}
          title="Delete log book entry?"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}
