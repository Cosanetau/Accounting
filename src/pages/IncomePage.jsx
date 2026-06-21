import { Download, Plus, Upload } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import AttachmentLink from '../components/AttachmentLink';
import ConfirmModal from '../components/ConfirmModal';
import GstSummaryBar from '../components/GstSummaryBar';
import PeriodPicker from '../components/PeriodPicker';
import RecordActions from '../components/RecordActions';
import { useAuth } from '../lib/AuthContext';
import { uploadAccountingFile } from '../utils/attachments';
import {
  createIncome,
  deleteIncome,
  fetchSummary,
  listIncome,
  syncStripeIncome,
  updateIncome,
} from '../utils/accountingApi';
import { formatMoney, splitGstFromInc } from '../utils/gst';

const emptyForm = {
  entryDate: new Date().toISOString().slice(0, 10),
  description: '',
  customerName: '',
  amountIncGst: '',
  category: 'subscription',
  notes: '',
  receiptFile: null,
  existingReceiptPath: '',
  existingReceiptFilename: '',
  clearReceipt: false,
};

function itemToForm(item) {
  return {
    entryDate: item.entryDate,
    description: item.description,
    customerName: item.customerName || '',
    amountIncGst: String(item.amountIncGst || ''),
    category: item.category || 'subscription',
    notes: item.notes || '',
    receiptFile: null,
    existingReceiptPath: item.receiptPath || '',
    existingReceiptFilename: item.receiptFilename || '',
    clearReceipt: false,
  };
}

export default function IncomePage() {
  const { session, canEdit, accountingUser } = useAuth();
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

  async function handleSaveIncome(event) {
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
          'income',
        );
        receiptPath = uploaded.receiptPath;
        receiptFilename = uploaded.receiptFilename;
        clearReceipt = false;
      }

      const payload = {
        entryDate: form.entryDate,
        description: form.description,
        customerName: form.customerName,
        amountIncGst: form.amountIncGst,
        category: form.category,
        notes: form.notes,
        receiptPath,
        receiptFilename,
        clearReceipt,
        gstMode: 'inc',
      };

      if (editingItem) {
        await updateIncome(session.access_token, { id: editingItem.id, ...payload });
      } else {
        await createIncome(session.access_token, payload);
      }

      closeModal();
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || 'Could not save sale.');
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
      await deleteIncome(session.access_token, deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message || 'Could not delete sale.');
    } finally {
      setIsDeleting(false);
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
              <button className="primary-action" type="button" onClick={openCreateModal}>
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
              <th>Attachment</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canEdit ? 9 : 8}>Loading income...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 9 : 8}>No income recorded for this period.</td>
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
            onSubmit={handleSaveIncome}
          >
            <header>
              <h2>{editingItem ? 'Edit sale' : 'Add a sale'}</h2>
              <p>
                {editingItem
                  ? 'Update the sale details or replace the attachment.'
                  : 'Record income that did not come through Stripe.'}
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
                {editingItem ? 'Replace attachment' : 'Upload invoice / receipt / image'}
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
                {isSaving ? 'Saving...' : editingItem ? 'Save changes' : 'Save sale'}
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
          title="Delete sale?"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}
