const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function PeriodPicker({ year, month, onChange }) {
  const years = [];
  const currentYear = new Date().getFullYear();

  for (let value = currentYear; value >= currentYear - 5; value -= 1) {
    years.push(value);
  }

  return (
    <div className="period-picker">
      <label>
        <span>Month</span>
        <select
          value={month}
          onChange={(event) => onChange({ year, month: Number(event.target.value) })}
        >
          {MONTHS.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Year</span>
        <select
          value={year}
          onChange={(event) => onChange({ year: Number(event.target.value), month })}
        >
          {years.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
