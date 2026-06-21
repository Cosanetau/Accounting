import Stripe from 'stripe';
import { splitGstFromIncCents } from './gstSummary.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

function getStripeClient() {
  if (!stripeSecretKey) {
    return null;
  }

  return new Stripe(stripeSecretKey);
}

function formatStripeDate(unixSeconds) {
  if (!unixSeconds) {
    return new Date().toISOString().slice(0, 10);
  }

  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function buildIncomeFromPaidInvoice(invoice) {
  const amountCents = Number(invoice.amount_paid || invoice.total || 0);
  const gst = splitGstFromIncCents(amountCents);
  const customerName =
    invoice.customer_name ||
    invoice.customer_email ||
    invoice.customer?.name ||
    invoice.customer?.email ||
    'Stripe customer';

  return {
    entry_date: formatStripeDate(invoice.status_transitions?.paid_at || invoice.created),
    description: invoice.description || invoice.lines?.data?.[0]?.description || 'COSA subscription',
    customer_name: customerName,
    amount_ex_gst: gst.amountExGst,
    gst_amount: gst.gstAmount,
    amount_inc_gst: gst.amountIncGst,
    source: 'stripe',
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: invoice.payment_intent || null,
    category: 'subscription',
    notes: invoice.number ? `Stripe invoice ${invoice.number}` : 'Imported from Stripe',
  };
}

export async function syncStripeIncome({ supabaseAdmin, createdBy, startingAfter = '' }) {
  const stripe = getStripeClient();

  if (!stripe) {
    throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY in Vercel.');
  }

  const listParams = {
    limit: 100,
    status: 'paid',
    expand: ['data.customer'],
  };

  if (startingAfter) {
    listParams.starting_after = startingAfter;
  }

  const invoices = await stripe.invoices.list(listParams);
  let imported = 0;
  let skipped = 0;

  for (const invoice of invoices.data || []) {
    const { data: existing } = await supabaseAdmin
      .from('accounting_income')
      .select('id')
      .eq('stripe_invoice_id', invoice.id)
      .maybeSingle();

    if (existing?.id) {
      skipped += 1;
      continue;
    }

    const payload = buildIncomeFromPaidInvoice(invoice);

    const { error } = await supabaseAdmin.from('accounting_income').insert({
      ...payload,
      created_by: createdBy,
    });

    if (error) {
      if (String(error.message || '').includes('accounting_income_stripe_invoice_unique')) {
        skipped += 1;
        continue;
      }

      throw error;
    }

    imported += 1;
  }

  return {
    imported,
    skipped,
    hasMore: Boolean(invoices.has_more),
    lastInvoiceId: invoices.data?.[invoices.data.length - 1]?.id || '',
  };
}
