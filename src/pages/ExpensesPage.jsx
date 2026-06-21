import { Plus, Upload } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import GstSummaryBar from '../components/GstSummaryBar';
import PeriodPicker from '../components/PeriodPicker';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { createExpense, fetchSummary, listExpenses } from '../utils/accountingApi';
import { formatMoney, splitGstFromInc } from '../utils/gst';

const emptyForm = {
  entryDate: new Date().toISOString().slice(0, 10),
  supplierName: '',
  description: '',
  amountIncGst: '',
  gstClaimable: true,
  category: 'general',
  notes: '',
  receiptFile: null,
};

export default function ExpensesPage() {
  const { session, canEdit, accountingUser } = useAuth();
  const now = new Date();
  const [period, setPeriod] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!session?.access_token) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const [summaryResult, expenseResult] = await Promise.all([
        fetchSummary(session.access_token, period),
        listExpenses(session.access_token, period),
      ]);

      setSummary(summaryResult);
      setItems(expenseResult.items || []);
    } catch (error) {
      setErrorMessage(error.message || 'Could not load expenses.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, period]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function uploadReceipt(file) {
    if (!file || !accountingUser?.userId) {
      return { receiptPath: '', receiptFilename: '' };
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `receipts/${accountingUser.userId}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage.from('accounting-receipts').upload(path, file, {
      upsert: false,
    });

    if (error) {
      throw new Error(error.message || 'Receipt upload failed.');
    }

    return { receiptPath: path, receiptFilename: file.name };
  }

  async function handleCreateExpense(event) {
    event.preventDefault();

    if (!session?.access_token) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      let receiptPath = '';
      let receiptFilename = '';

      if (form.receiptFile) {
        const uploaded = await uploadReceipt(form.receiptFile);
        receiptPath = uploaded.receiptPath;
        receiptFilename = uploaded.receiptFilename;
      }

      await createExpense(session.access_token, {
        entryDate: form.entryDate,
        supplierName: form.supplierName,
        description: form.description,
        amountIncGst: form.amountIncGst,
        gstMode: 'inc',
        gstClaimable: form.gstClaimable,
        category: form.category,
        notes: form.notes,
        receiptPath,
        receiptFilename,
      });

      setShowModal(false);
      setForm(emptyForm);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || 'Could not save expense.');
    } finally {
      setIsSaving(false);
    }
  }

  const previewGst = splitGstFromInc(form.amountIncGst);

  return (
    <div className="accounting-page">
      <header className="accounting-page-header">
        <div>
          <span className="accounting-kicker">Expenses</span>
          <h1>Bills &amp; purchases</h1>
          <p>Upload supplier invoices and track GST on every expense.</p>
        </div>

        <div className="accounting-header-actions">
          <PeriodPicker month={period.month} year={period.year} onChange={setPeriod} />
          {canEdit ? (
            <button className="primary-action" type="button" onClick={() => setShowModal(true)}>
              <Plus size={16} />
              Add expense
            </button>
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
              <th>Supplier</th>
              <th>Description</th>
              <th>Ex GST</th>
              <th>GST</th>
              <th>Inc GST</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>Loading expenses...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7}>No expenses recorded for this period.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.entryDate}</td>
                  <td>{item.supplierName}</td>
                  <td>{item.description || '—'}</td>
                  <td>{formatMoney(item.amountExGst)}</td>
                  <td className="is-gst">{formatMoney(item.gstAmount)}</td>
                  <td>{formatMoney(item.amountIncGst)}</td>
                  <td>
                    {item.receiptFilename ? (
                      <span className="receipt-pill">{item.receiptFilename}</span>
                    ) : (
                      '—'
                    )}
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
            onSubmit={handleCreateExpense}
          >
            <header>
              <h2>Add expense</h2>
              <p>Enter the invoice total inc GST and upload the supplier bill.</p>
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
              Supplier
              <input
                required
                value={form.supplierName}
                onChange={(event) => setForm({ ...form, supplierName: event.target.value })}
              />
            </label>
            <label>
              Description
              <input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
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

            <label className="checkbox-row">
              <input
                checked={form.gstClaimable}
                type="checkbox"
                onChange={(event) => setForm({ ...form, gstClaimable: event.target.checked })}
              />
              GST claimable on this expense
            </label>

            <label className="file-upload">
              <span>
                <Upload size={16} />
                Upload invoice / receipt
              </span>
              <input
                accept="image/*,application/pdf"
                type="file"
                onChange={(event) =>
                  setForm({ ...form, receiptFile: event.target.files?.[0] || null })
                }
              />
              {form.receiptFile ? <small>{form.receiptFile.name}</small> : null}
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
              <button className="primary-action" disabled={isSaving} type="submit">
                {isSaving ? 'Saving...' : 'Save expense'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
