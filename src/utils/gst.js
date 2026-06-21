const GST_RATE = 0.1;

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

export function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function formatMoney(value) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(Number(value || 0));
}

export function formatGstSummary({ incomeGst = 0, expenseGst = 0 }) {
  const net = roundMoney(incomeGst - expenseGst);
  return {
    incomeGst: roundMoney(incomeGst),
    expenseGst: roundMoney(expenseGst),
    netGst: net,
    netLabel: net >= 0 ? 'GST payable' : 'GST refund',
  };
}
