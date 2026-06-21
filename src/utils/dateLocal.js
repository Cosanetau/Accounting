export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getLocalPeriod(date = new Date()) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

export function periodFromEntryDate(entryDate) {
  const [year, month] = String(entryDate || '').split('-').map(Number);

  if (!year || !month) {
    return getLocalPeriod();
  }

  return { year, month };
}
