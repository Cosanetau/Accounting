export function getCurrentFinancialYearEnd(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return month >= 7 ? year + 1 : year;
}

export function getFinancialYearEndFromEntryDate(entryDate) {
  const [year, month] = String(entryDate || '').split('-').map(Number);

  if (!year || !month) {
    return getCurrentFinancialYearEnd();
  }

  return month >= 7 ? year + 1 : year;
}

export function getFinancialYearDateRange(financialYearEnd) {
  const endYear = Number(financialYearEnd);

  if (!endYear || endYear < 1900) {
    return getFinancialYearDateRange(getCurrentFinancialYearEnd());
  }

  const startYear = endYear - 1;

  return {
    financialYear: endYear,
    startDate: `${startYear}-07-01`,
    endDate: `${endYear}-07-01`,
  };
}
