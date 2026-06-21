import Stripe from 'stripe';
import { createSupabaseAdmin } from './shared/supabaseServer.js';
import { importStripeInvoiceById } from './shared/stripeIncomeSync.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(request) {
  if (typeof request.text === 'function') {
    const text = await request.text();
    return Buffer.from(text);
  }

  if (Buffer.isBuffer(request.body)) {
    return request.body;
  }

  if (typeof request.body === 'string') {
    return Buffer.from(request.body);
  }

  if (request.body && typeof request.body === 'object') {
    return Buffer.from(JSON.stringify(request.body));
  }

  if (typeof request.on === 'function') {
    const chunks = await new Promise((resolve, reject) => {
      const collected = [];

      request.on('data', (chunk) => {
        collected.push(Buffer.from(chunk));
      });

      request.on('end', () => resolve(collected));
      request.on('error', reject);
    });

    return Buffer.concat(chunks);
  }

  return Buffer.from('');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  if (!stripeSecretKey || !stripeWebhookSecret) {
    return response.status(500).json({
      error:
        'Stripe webhook is not configured. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Vercel.',
    });
  }

  const stripe = new Stripe(stripeSecretKey);
  const signature = request.headers['stripe-signature'];

  let event;

  try {
    const rawBody = await readRawBody(request);
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch (error) {
    return response.status(400).json({
      error: `Webhook signature verification failed: ${error.message}`,
    });
  }

  try {
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const supabaseAdmin = createSupabaseAdmin();

      await importStripeInvoiceById({
        supabaseAdmin,
        invoiceId: invoice.id,
        createdBy: null,
      });
    }

    return response.status(200).json({ received: true });
  } catch (error) {
    return response.status(500).json({
      error: error?.message || 'Webhook processing failed.',
    });
  }
}
