import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import PeriodPicker from '../components/PeriodPicker';
import { useAuth } from '../lib/AuthContext';
import { createLogbookEntry, listLogbook } from '../utils/accountingApi';

const emptyForm = {
  entryDate: new Date().toISOString().slice(0, 10),
  description: '',
  purpose: '',
  startLocation: '',
  endLocation: '',
  distanceKm: '',
  notes: '',
};

export default function LogbookPage() {
  const { session, canEdit } = useAuth();
  const now = new Date();
  const [period, setPeriod] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    if (!session?.access_token) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const result = await listLogbook(session.access_token, period);
      setItems(result.items || []);
    } catch (error) {
      setErrorMessage(error.message || 'Could not load log book.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, period]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCreateEntry(event) {
    event.preventDefault();

    if (!session?.access_token) {
      return;
    }

    try {
      await createLogbookEntry(session.access_token, {
        ...form,
        distanceKm: form.distanceKm ? Number(form.distanceKm) : null,
      });
      setShowModal(false);
      setForm(emptyForm);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || 'Could not save log book entry.');
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
            <button className="primary-action" type="button" onClick={() => setShowModal(true)}>
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Loading log book...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6}>No log book entries for this period.</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {showModal ? (
        <div className="accounting-modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="accounting-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleCreateEntry}
          >
            <header>
              <h2>Add log book entry</h2>
              <p>Record a trip or business activity for your accountant.</p>
            </header>

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
              <button className="secondary-action" type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="primary-action" type="submit">
                Save entry
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
