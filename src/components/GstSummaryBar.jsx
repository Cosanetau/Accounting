import { formatMoney } from '../utils/gst';

export default function GstSummaryBar({ summary, loading }) {
  if (loading) {
    return <div className="gst-summary-bar is-loading">Loading GST summary...</div>;
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="gst-summary-bar">
      <div className="gst-summary-card">
        <span>Income GST</span>
        <strong>{formatMoney(summary.income?.gstAmount)}</strong>
      </div>
      <div className="gst-summary-card">
        <span>Expense GST</span>
        <strong>{formatMoney(summary.expenses?.gstCollectedOnExpenses)}</strong>
      </div>
      <div className={`gst-summary-card is-net${summary.netGst < 0 ? ' is-refund' : ''}`}>
        <span>{summary.netGstLabel}</span>
        <strong>{formatMoney(Math.abs(summary.netGst))}</strong>
      </div>
      <div className="gst-summary-card is-muted">
        <span>Income (inc GST)</span>
        <strong>{formatMoney(summary.income?.amountIncGst)}</strong>
      </div>
      <div className="gst-summary-card is-muted">
        <span>Expenses (inc GST)</span>
        <strong>{formatMoney(summary.expenses?.amountIncGst)}</strong>
      </div>
    </div>
  );
}
