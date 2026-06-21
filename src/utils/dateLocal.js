export const FIRST_FINANCIAL_YEAR_END = 2026;

export function clampFinancialYear(financialYearEnd) {
  const value = Number(financialYearEnd);

  if (!value || value < FIRST_FINANCIAL_YEAR_END) {
    return FIRST_FINANCIAL_YEAR_END;
  }

  return value;
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getLocalFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return clampFinancialYear(month >= 7 ? year + 1 : year);
}

export function financialYearFromEntryDate(entryDate) {
  const [year, month] = String(entryDate || '').split('-').map(Number);

  if (!year || !month) {
    return getLocalFinancialYear();
  }

  return clampFinancialYear(month >= 7 ? year + 1 : year);
}

export function formatFinancialYearLabel(endYear) {
  const startYear = endYear - 1;

  return `FY ${startYear}–${String(endYear).slice(-2)}`;
}
