const GST_RATE = 0.1;

export function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function splitGstFromIncCents(amountCents) {
  const inc = Number(amountCents || 0) / 100;
  const ex = inc / (1 + GST_RATE);
  const gst = inc - ex;

  return {
    amountExGst: roundMoney(ex),
    gstAmount: roundMoney(gst),
    amountIncGst: roundMoney(inc),
  };
}

export function splitGstFromInc(amountIncGst) {
  const inc = Number(amountIncGst || 0);
  const ex = inc / (1 + GST_RATE);
  const gst = inc - ex;

  return {
    amountExGst: roundMoney(ex),
    gstAmount: roundMoney(gst),
    amountIncGst: roundMoney(inc),
  };
}

export function combineGstFromEx(amountExGst) {
  const ex = Number(amountExGst || 0);
  const gst = ex * GST_RATE;
  const inc = ex + gst;

  return {
    amountExGst: roundMoney(ex),
    gstAmount: roundMoney(gst),
    amountIncGst: roundMoney(inc),
  };
}

export async function getPeriodSummary(supabaseAdmin, { year, month }) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const [{ data: incomeRows }, { data: expenseRows }] = await Promise.all([
    supabaseAdmin
      .from('accounting_income')
      .select('amount_ex_gst, gst_amount, amount_inc_gst')
      .gte('entry_date', startDate)
      .lt('entry_date', endDate),
    supabaseAdmin
      .from('accounting_expenses')
      .select('amount_ex_gst, gst_amount, amount_inc_gst, gst_claimable')
      .gte('entry_date', startDate)
      .lt('entry_date', endDate),
  ]);

  const income = (incomeRows || []).reduce(
    (totals, row) => ({
      ex: totals.ex + Number(row.amount_ex_gst || 0),
      gst: totals.gst + Number(row.gst_amount || 0),
      inc: totals.inc + Number(row.amount_inc_gst || 0),
    }),
    { ex: 0, gst: 0, inc: 0 },
  );

  const expenses = (expenseRows || []).reduce(
    (totals, row) => {
      const claimable = row.gst_claimable !== false;
      return {
        ex: totals.ex + Number(row.amount_ex_gst || 0),
        gst: totals.gst + (claimable ? Number(row.gst_amount || 0) : 0),
        inc: totals.inc + Number(row.amount_inc_gst || 0),
      };
    },
    { ex: 0, gst: 0, inc: 0 },
  );

  const netGst = roundMoney(income.gst - expenses.gst);

  return {
    year,
    month,
    income: {
      amountExGst: roundMoney(income.ex),
      gstAmount: roundMoney(income.gst),
      amountIncGst: roundMoney(income.inc),
    },
    expenses: {
      amountExGst: roundMoney(expenses.ex),
      gstCollectedOnExpenses: roundMoney(expenses.gst),
      amountIncGst: roundMoney(expenses.inc),
    },
    netGst,
    netGstLabel: netGst >= 0 ? 'GST payable' : 'GST refund',
  };
}
