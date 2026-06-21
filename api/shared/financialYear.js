export const FIRST_FINANCIAL_YEAR_END = 2026;

export function clampFinancialYear(financialYearEnd) {
  const value = Number(financialYearEnd);

  if (!value || value < FIRST_FINANCIAL_YEAR_END) {
    return FIRST_FINANCIAL_YEAR_END;
  }

  return value;
}

export function getCurrentFinancialYearEnd(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return clampFinancialYear(month >= 7 ? year + 1 : year);
}

export function getFinancialYearEndFromEntryDate(entryDate) {
  const [year, month] = String(entryDate || '').split('-').map(Number);

  if (!year || !month) {
    return getCurrentFinancialYearEnd();
  }

  return clampFinancialYear(month >= 7 ? year + 1 : year);
}

export function getFinancialYearDateRange(financialYearEnd) {
  const endYear = clampFinancialYear(financialYearEnd);

  const startYear = endYear - 1;

  return {
    financialYear: endYear,
    startDate: `${startYear}-07-01`,
    endDate: `${endYear}-07-01`,
  };
}
