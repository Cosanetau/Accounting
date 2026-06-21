import { Plus, Upload } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import AttachmentLink from '../components/AttachmentLink';
import ConfirmModal from '../components/ConfirmModal';
import GstSummaryBar from '../components/GstSummaryBar';
import PeriodPicker from '../components/PeriodPicker';
import RecordActions from '../components/RecordActions';
import { useAuth } from '../lib/AuthContext';
import { uploadAccountingFile } from '../utils/attachments';
import {
  createExpense,
  deleteExpense,
  fetchSummary,
  listExpenses,
  updateExpense,
} from '../utils/accountingApi';
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
  existingReceiptPath: '',
  existingReceiptFilename: '',
  clearReceipt: false,
};

function itemToForm(item) {
  return {
    entryDate: item.entryDate,
    supplierName: item.supplierName,
    description: item.description || '',
    amountIncGst: String(item.amountIncGst || ''),
    gstClaimable: item.gstClaimable !== false,
    category: item.category || 'general',
    notes: item.notes || '',
    receiptFile: null,
    existingReceiptPath: item.receiptPath || '',
    existingReceiptFilename: item.receiptFilename || '',
    clearReceipt: false,
  };
}

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
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  function openCreateModal() {
    setEditingItem(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setForm(itemToForm(item));
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingItem(null);
    setForm(emptyForm);
  }

  async function handleSaveExpense(event) {
    event.preventDefault();

    if (!session?.access_token) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      let receiptPath = form.existingReceiptPath;
      let receiptFilename = form.existingReceiptFilename;
      let clearReceipt = form.clearReceipt;

      if (form.receiptFile) {
        const uploaded = await uploadAccountingFile(
          form.receiptFile,
          accountingUser.userId,
          'receipts',
        );
        receiptPath = uploaded.receiptPath;
        receiptFilename = uploaded.receiptFilename;
        clearReceipt = false;
      }

      const payload = {
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
        clearReceipt,
      };

      if (editingItem) {
        await updateExpense(session.access_token, { id: editingItem.id, ...payload });
      } else {
        await createExpense(session.access_token, payload);
      }

      closeModal();
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || 'Could not save expense.');
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
      await deleteExpense(session.access_token, deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || 'Could not delete expense.');
    } finally {
      setIsDeleting(false);
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
            <button className="primary-action" type="button" onClick={openCreateModal}>
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
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7}>Loading expenses...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7}>No expenses recorded for this period.</td>
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
                    <AttachmentLink filename={item.receiptFilename} path={item.receiptPath} />
                  </td>
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
        <div className="accounting-modal-backdrop" onClick={closeModal}>
          <form
            className="accounting-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSaveExpense}
          >
            <header>
              <h2>{editingItem ? 'Edit expense' : 'Add expense'}</h2>
              <p>
                {editingItem
                  ? 'Update the expense details or replace the receipt.'
                  : 'Enter the invoice total inc GST and upload the supplier bill.'}
              </p>
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

            {form.existingReceiptFilename && !form.clearReceipt ? (
              <div className="current-attachment">
                <span>Current file:</span>
                <AttachmentLink
                  filename={form.existingReceiptFilename}
                  path={form.existingReceiptPath}
                />
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setForm({ ...form, clearReceipt: true, receiptFile: null })}
                >
                  Remove attachment
                </button>
              </div>
            ) : null}

            <label className="file-upload">
              <span>
                <Upload size={16} />
                {editingItem ? 'Replace receipt' : 'Upload invoice / receipt'}
              </span>
              <input
                accept="image/*,application/pdf"
                type="file"
                onChange={(event) =>
                  setForm({
                    ...form,
                    receiptFile: event.target.files?.[0] || null,
                    clearReceipt: false,
                  })
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
              <button className="secondary-action" type="button" onClick={closeModal}>
                Cancel
              </button>
              <button className="primary-action" disabled={isSaving} type="submit">
                {isSaving ? 'Saving...' : editingItem ? 'Save changes' : 'Save expense'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          confirmLabel="Yes, delete"
          isBusy={isDeleting}
          message={`Are you sure you want to delete the expense from "${deleteTarget.supplierName}"? This cannot be undone.`}
          title="Delete expense?"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}
