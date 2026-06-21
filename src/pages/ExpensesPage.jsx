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
import { getLocalDateString, getLocalFinancialYear, financialYearFromEntryDate } from '../utils/dateLocal';

function createEmptyForm() {
  return {
    entryDate: getLocalDateString(),
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
}

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
  const [financialYear, setFinancialYear] = useState(() => getLocalFinancialYear());
  const [summary, setSummary] = useState(null);
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
    async (financialYearOverride) => {
      if (!session?.access_token) {
        return;
      }

      const activeFinancialYear = financialYearOverride || financialYear;

      setLoading(true);
      setErrorMessage('');

      try {
        const expenseResult = await listExpenses(session.access_token, {
          financialYear: activeFinancialYear,
        });
        setItems(expenseResult.items || []);
      } catch (error) {
        setErrorMessage(error.message || 'Could not load expenses.');
      }

      try {
        const summaryResult = await fetchSummary(session.access_token, {
          financialYear: activeFinancialYear,
        });
        setSummary(summaryResult);
      } catch (error) {
        setErrorMessage((current) => current || error.message || 'Could not load GST summary.');
      } finally {
        setLoading(false);
      }
    },
    [session?.access_token, financialYear],
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

  async function handleSaveExpense(event) {
    event.preventDefault();

    if (!session?.access_token) {
      return;
    }

    setIsSaving(true);
    setModalError('');

    try {
      let receiptPath = form.existingReceiptPath;
      let receiptFilename = form.existingReceiptFilename;
      let clearReceipt = form.clearReceipt;

      if (form.receiptFile) {
        if (!accountingUser?.userId) {
          throw new Error('Your session expired. Sign out and sign in again.');
        }

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

      let savedItem;

      if (editingItem) {
        const result = await updateExpense(session.access_token, { id: editingItem.id, ...payload });
        savedItem = result.item;
      } else {
        const result = await createExpense(session.access_token, payload);
        savedItem = result.item;
      }

      const savedFinancialYear = financialYearFromEntryDate(savedItem?.entryDate || form.entryDate);
      setFinancialYear(savedFinancialYear);
      closeModal();
      await loadData(savedFinancialYear);
    } catch (error) {
      setModalError(error.message || 'Could not save expense.');
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
          <PeriodPicker financialYear={financialYear} onChange={setFinancialYear} />
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
                <td colSpan={canEdit ? 8 : 7}>No expenses recorded for this financial year.</td>
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
        <div className="accounting-modal-backdrop">
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
