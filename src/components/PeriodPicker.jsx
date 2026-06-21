import { formatFinancialYearLabel, getLocalFinancialYear } from '../utils/dateLocal';

export default function PeriodPicker({ financialYear, onChange }) {
  const currentFinancialYear = getLocalFinancialYear();
  const years = [];

  for (let end = currentFinancialYear; end >= currentFinancialYear - 6; end -= 1) {
    years.push(end);
  }

  return (
    <div className="period-picker">
      <label>
        <span>Financial year</span>
        <select
          value={financialYear}
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
