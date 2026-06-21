import {
  createSupabaseAdmin,
  createSupabaseUserClient,
  getSupabaseConfig,
} from './supabaseServer.js';

function formatError(error, fallback) {
  return error?.message || error?.error_description || error?.details || fallback;
}

export async function requireAccountingUser(request, { minRole } = {}) {
  try {
    const { supabaseAnonKey, supabaseServiceRoleKey } = getSupabaseConfig();

    if (!supabaseAnonKey || !supabaseServiceRoleKey) {
      return {
        error: 'Server is not configured. Add Supabase keys in Vercel.',
        status: 500,
      };
    }

    const accessToken = String(request.headers.authorization || '')
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (!accessToken) {
      return { error: 'Missing login session.', status: 401 };
    }

    const supabaseUser = createSupabaseUserClient(accessToken);
    const supabaseAdmin = createSupabaseAdmin();

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return { error: 'Invalid or expired session.', status: 401 };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('accounting_users')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return {
        error: 'This account is not authorised for COSA Accounting.',
        status: 403,
      };
    }

    if (minRole === 'owner' && profile.role !== 'owner') {
      return { error: 'Only the owner can perform this action.', status: 403 };
    }

    if (
      minRole === 'accountant' &&
      !['owner', 'accountant'].includes(profile.role)
    ) {
      return { error: 'You do not have permission to edit records.', status: 403 };
    }

    return {
      user,
      profile,
      supabaseAdmin,
      supabaseUser,
    };
  } catch (error) {
    return {
      error: formatError(error, 'Authentication check failed.'),
      status: 500,
    };
  }
}

export function mapIncomeRow(row) {
  return {
    id: row.id,
    entryDate: row.entry_date,
    description: row.description,
    customerName: row.customer_name || '',
    amountExGst: Number(row.amount_ex_gst || 0),
    gstAmount: Number(row.gst_amount || 0),
    amountIncGst: Number(row.amount_inc_gst || 0),
    source: row.source,
    category: row.category,
    notes: row.notes || '',
    stripeChargeId: row.stripe_charge_id || '',
    stripeInvoiceId: row.stripe_invoice_id || '',
    createdAt: row.created_at,
  };
}

export function mapExpenseRow(row) {
  return {
    id: row.id,
    entryDate: row.entry_date,
    supplierName: row.supplier_name,
    description: row.description || '',
    amountExGst: Number(row.amount_ex_gst || 0),
    gstAmount: Number(row.gst_amount || 0),
    amountIncGst: Number(row.amount_inc_gst || 0),
    gstClaimable: Boolean(row.gst_claimable),
    category: row.category,
    receiptPath: row.receipt_path || '',
    receiptFilename: row.receipt_filename || '',
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

export function mapLogbookRow(row) {
  return {
    id: row.id,
    entryDate: row.entry_date,
    description: row.description,
    purpose: row.purpose || '',
    startLocation: row.start_location || '',
    endLocation: row.end_location || '',
    distanceKm: row.distance_km != null ? Number(row.distance_km) : null,
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}
