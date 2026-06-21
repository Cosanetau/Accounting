import {
  clampFinancialYear,
  FIRST_FINANCIAL_YEAR_END,
  formatFinancialYearLabel,
  getLocalFinancialYear,
} from '../utils/dateLocal';

export default function PeriodPicker({ financialYear, onChange }) {
  const currentFinancialYear = getLocalFinancialYear();
  const years = [];

  for (let end = currentFinancialYear; end >= FIRST_FINANCIAL_YEAR_END; end -= 1) {
    years.push(end);
  }

  return (
    <div className="period-picker">
      <label>
        <span>Financial year</span>
        <select
          value={clampFinancialYear(financialYear)}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {years.map((end) => (
            <option key={end} value={end}>
              {formatFinancialYearLabel(end)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
