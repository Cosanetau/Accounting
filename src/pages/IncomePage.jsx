import { Download, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import GstSummaryBar from '../components/GstSummaryBar';
import PeriodPicker from '../components/PeriodPicker';
import { useAuth } from '../lib/AuthContext';
import {
  createIncome,
  fetchSummary,
  listIncome,
  syncStripeIncome,
} from '../utils/accountingApi';
import { formatMoney, splitGstFromInc } from '../utils/gst';

const emptyForm = {
  entryDate: new Date().toISOString().slice(0, 10),
  description: '',
  customerName: '',
  amountIncGst: '',
  category: 'subscription',
  notes: '',
};

export default function IncomePage() {
  const { session, canEdit } = useAuth();
  const now = new Date();
  const [period, setPeriod] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
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
      const [summaryResult, incomeResult] = await Promise.all([
        fetchSummary(session.access_token, period),
        listIncome(session.access_token, period),
      ]);

      setSummary(summaryResult);
      setItems(incomeResult.items || []);
    } catch (error) {
      setErrorMessage(error.message || 'Could not load income.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, period]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSyncStripe() {
    if (!session?.access_token) {
      return;
    }

    setSyncing(true);
    setErrorMessage('');

    try {
      const result = await syncStripeIncome(session.access_token);
      window.alert(
        `Stripe sync complete. Imported ${result.imported}, skipped ${result.skipped}.`,
      );
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || 'Stripe sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreateIncome(event) {
    event.preventDefault();

    if (!session?.access_token) {
      return;
    }

    try {
      await createIncome(session.access_token, {
        ...form,
        gstMode: 'inc',
      });
      setShowModal(false);
      setForm(emptyForm);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || 'Could not save sale.');
    }
  }

  const previewGst = splitGstFromInc(form.amountIncGst);

  return (
    <div className="accounting-page">
      <header className="accounting-page-header">
        <div>
          <span className="accounting-kicker">Income</span>
          <h1>Sales &amp; revenue</h1>
          <p>Stripe subscriptions import automatically. Add other sales manually.</p>
        </div>

        <div className="accounting-header-actions">
          <PeriodPicker month={period.month} year={period.year} onChange={setPeriod} />
          {canEdit ? (
            <>
              <button
                className="secondary-action"
                disabled={syncing}
                type="button"
                onClick={handleSyncStripe}
              >
                <Download size={16} />
                {syncing ? 'Syncing Stripe...' : 'Import from Stripe'}
              </button>
              <button className="primary-action" type="button" onClick={() => setShowModal(true)}>
                <Plus size={16} />
                Add a sale
              </button>
            </>
          ) : null}
        </div>
      </header>

      <GstSummaryBar loading={loading} summary={summary} />

      {errorMessage ? <div className="accounting-error-banner">{errorMessage}</div> : null}

      <section className="accounting-table-card">
        <table className="accounting-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Customer</th>
              <th>Ex GST</th>
              <th>GST</th>
              <th>Inc GST</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>Loading income...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7}>No income recorded for this period.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.entryDate}</td>
                  <td>{item.description}</td>
                  <td>{item.customerName || '—'}</td>
                  <td>{formatMoney(item.amountExGst)}</td>
                  <td className="is-gst">{formatMoney(item.gstAmount)}</td>
                  <td>{formatMoney(item.amountIncGst)}</td>
                  <td>
                    <span className={`source-pill is-${item.source}`}>{item.source}</span>
                  </td>
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
            onSubmit={handleCreateIncome}
          >
            <header>
              <h2>Add a sale</h2>
              <p>Record income that did not come through Stripe.</p>
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
              Customer
              <input
                value={form.customerName}
                onChange={(event) => setForm({ ...form, customerName: event.target.value })}
              />
            </label>
            <label>
              Amount inc GST
              <input
                inputMode="decimal"
                required
                value={form.amountIncGst}
                onChange={(event) => setForm({ ...form, amountIncGst: event.target.value })}
              />
            </label>

            <div className="gst-preview">
              <span>Ex GST: {formatMoney(previewGst.amountExGst)}</span>
              <span>GST: {formatMoney(previewGst.gstAmount)}</span>
            </div>

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
                Save sale
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
