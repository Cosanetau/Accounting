import Stripe from 'stripe';
import { roundMoney, splitGstFromIncCents } from './gstSummary.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const FIRST_INCOME_DATE = '2025-07-01';
const MAX_SYNC_PAGES = 50;

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

function resolveCustomerName(invoice) {
  const customer = typeof invoice.customer === 'object' ? invoice.customer : null;

  return (
    invoice.customer_name ||
    customer?.name ||
    invoice.customer_email ||
    customer?.email ||
    'Stripe customer'
  );
}

function resolveDescription(invoice) {
  if (invoice.description) {
    return invoice.description;
  }

  const lineDescriptions = (invoice.lines?.data || [])
    .map((line) => line.description)
    .filter(Boolean);

  if (lineDescriptions.length > 0) {
    return lineDescriptions.join('; ');
  }

  return invoice.subscription ? 'COSA subscription' : 'Stripe sale';
}

function resolveAmounts(invoice) {
  const totalCents = Number(invoice.amount_paid || invoice.total || 0);
  const taxCents =
    (invoice.total_tax_amounts || []).reduce(
      (sum, taxLine) => sum + Number(taxLine.amount || 0),
      0,
    ) || Number(invoice.tax || 0);

  if (taxCents > 0 && totalCents > 0) {
    const amountIncGst = roundMoney(totalCents / 100);
    const gstAmount = roundMoney(taxCents / 100);
    const amountExGst = roundMoney(amountIncGst - gstAmount);

    return { amountExGst, gstAmount, amountIncGst };
  }

  return splitGstFromIncCents(totalCents);
}

function resolveChargeId(invoice) {
  if (typeof invoice.charge === 'string') {
    return invoice.charge;
  }

  if (invoice.charge?.id) {
    return invoice.charge.id;
  }

  const paymentIntent =
    typeof invoice.payment_intent === 'object' ? invoice.payment_intent : null;

  if (typeof paymentIntent?.latest_charge === 'string') {
    return paymentIntent.latest_charge;
  }

  return paymentIntent?.latest_charge?.id || null;
}

function resolvePaymentIntentId(invoice) {
  if (typeof invoice.payment_intent === 'string') {
    return invoice.payment_intent;
  }

  return invoice.payment_intent?.id || null;
}

function buildNotes(invoice) {
  const parts = [];

  if (invoice.number) {
    parts.push(`Invoice #${invoice.number}`);
  }

  if (invoice.hosted_invoice_url) {
    parts.push(`Hosted invoice: ${invoice.hosted_invoice_url}`);
  }

  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

  if (subscriptionId) {
    parts.push(`Subscription: ${subscriptionId}`);
  }

  if (invoice.customer_email) {
    parts.push(`Email: ${invoice.customer_email}`);
  }

  const period = invoice.lines?.data?.[0]?.period;

  if (period?.start && period?.end) {
    parts.push(
      `Period: ${formatStripeDate(period.start)} to ${formatStripeDate(period.end)}`,
    );
  }

  return parts.join(' | ') || 'Imported from Stripe';
}

export function buildIncomeFromPaidInvoice(invoice) {
  const amounts = resolveAmounts(invoice);
  const entryDate = formatStripeDate(
    invoice.status_transitions?.paid_at || invoice.created,
  );

  return {
    entry_date: entryDate,
    description: resolveDescription(invoice),
    customer_name: resolveCustomerName(invoice),
    amount_ex_gst: amounts.amountExGst,
    gst_amount: amounts.gstAmount,
    amount_inc_gst: amounts.amountIncGst,
    source: 'stripe',
    stripe_charge_id: resolveChargeId(invoice),
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: resolvePaymentIntentId(invoice),
    category: invoice.subscription ? 'subscription' : 'general',
    notes: buildNotes(invoice),
  };
}

async function storeInvoicePdf(supabaseAdmin, invoice) {
  const pdfUrl = invoice.invoice_pdf;

  if (!pdfUrl) {
    return { receiptPath: null, receiptFilename: null };
  }

  try {
    const response = await fetch(pdfUrl);

    if (!response.ok) {
      return { receiptPath: null, receiptFilename: null };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const receiptFilename = `${invoice.number || invoice.id}.pdf`;
    const receiptPath = `income/stripe/${invoice.id}.pdf`;

    const { error } = await supabaseAdmin.storage
      .from('accounting-receipts')
      .upload(receiptPath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      return { receiptPath: null, receiptFilename: null };
    }

    return { receiptPath, receiptFilename };
  } catch {
    return { receiptPath: null, receiptFilename: null };
  }
}

export async function importStripeInvoice({ supabaseAdmin, invoice, createdBy = null }) {
  if (!invoice?.id || invoice.status !== 'paid') {
    return { imported: false, skipped: true, reason: 'not_paid' };
  }

  const payload = buildIncomeFromPaidInvoice(invoice);

  if (payload.entry_date < FIRST_INCOME_DATE) {
    return { imported: false, skipped: true, reason: 'before_first_fy' };
  }

  const { data: existing } = await supabaseAdmin
    .from('accounting_income')
    .select('id')
    .eq('stripe_invoice_id', invoice.id)
    .maybeSingle();

  if (existing?.id) {
    return { imported: false, skipped: true, reason: 'duplicate' };
  }

  const attachment = await storeInvoicePdf(supabaseAdmin, invoice);

  const { error } = await supabaseAdmin.from('accounting_income').insert({
    ...payload,
    receipt_path: attachment.receiptPath,
    receipt_filename: attachment.receiptFilename,
    created_by: createdBy,
  });

  if (error) {
    if (String(error.message || '').includes('accounting_income_stripe_invoice_unique')) {
      return { imported: false, skipped: true, reason: 'duplicate' };
    }

    if (String(error.message || '').includes('accounting_income_stripe_charge_unique')) {
      return { imported: false, skipped: true, reason: 'duplicate_charge' };
    }

    throw error;
  }

  return { imported: true, skipped: false };
}

async function syncStripeIncomePage({ supabaseAdmin, createdBy, startingAfter = '' }) {
  const stripe = getStripeClient();

  if (!stripe) {
    throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY in Vercel.');
  }

  const listParams = {
    limit: 100,
    status: 'paid',
    expand: ['data.customer', 'data.payment_intent', 'data.lines.data'],
  };

  if (startingAfter) {
    listParams.starting_after = startingAfter;
  }

  const invoices = await stripe.invoices.list(listParams);
  let imported = 0;
  let skipped = 0;

  for (const invoice of invoices.data || []) {
    const result = await importStripeInvoice({ supabaseAdmin, invoice, createdBy });

    if (result.imported) {
      imported += 1;
    } else if (result.skipped) {
      skipped += 1;
    }
  }

  return {
    imported,
    skipped,
    hasMore: Boolean(invoices.has_more),
    lastInvoiceId: invoices.data?.[invoices.data.length - 1]?.id || '',
  };
}

export async function syncStripeIncome({ supabaseAdmin, createdBy }) {
  let imported = 0;
  let skipped = 0;
  let startingAfter = '';
  let hasMore = true;
  let pages = 0;

  while (hasMore && pages < MAX_SYNC_PAGES) {
    const pageResult = await syncStripeIncomePage({
      supabaseAdmin,
      createdBy,
      startingAfter,
    });

    imported += pageResult.imported;
    skipped += pageResult.skipped;
    hasMore = pageResult.hasMore;
    startingAfter = pageResult.lastInvoiceId;
    pages += 1;

    if (!startingAfter) {
      break;
    }
  }

  return {
    imported,
    skipped,
    pages,
    hasMore,
  };
}

export async function importStripeInvoiceById({ supabaseAdmin, invoiceId, createdBy = null }) {
  const stripe = getStripeClient();

  if (!stripe) {
    throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY in Vercel.');
  }

  const invoice = await stripe.invoices.retrieve(invoiceId, {
    expand: ['customer', 'payment_intent', 'lines.data'],
  });

  return importStripeInvoice({ supabaseAdmin, invoice, createdBy });
}
