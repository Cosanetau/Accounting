import {
  mapExpenseRow,
  mapIncomeRow,
  mapLogbookRow,
  requireAccountingUser,
} from './shared/accountingAuth.js';
import {
  clampFinancialYear,
  getCurrentFinancialYearEnd,
  getFinancialYearDateRange,
} from './shared/financialYear.js';
import { combineGstFromEx, getPeriodSummary, splitGstFromInc } from './shared/gstSummary.js';
import { syncStripeIncome } from './shared/stripeIncomeSync.js';

function getAction(request) {
  if (request.query?.action) {
    return String(request.query.action).trim();
  }

  if (request.url) {
    try {
      const url = new URL(request.url, 'https://accounting.cosa.net.au');
      const action = url.searchParams.get('action')?.trim();
      if (action) {
        return action;
      }
    } catch {
      // Fall through.
    }
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    return '';
  }

  return String(request.body?.action || '').trim();
}

function getFinancialYearFromRequest(request) {
  return clampFinancialYear(request.body?.financialYear || getCurrentFinancialYearEnd());
}

function getDateRangeFromRequest(request) {
  return getFinancialYearDateRange(getFinancialYearFromRequest(request));
}

export default async function handler(request, response) {
  const action = getAction(request);

  if (action === 'me') {
    const auth = await requireAccountingUser(request);

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    return response.status(200).json({
      email: auth.user.email || auth.profile.email,
      userId: auth.user.id,
      displayName: auth.profile.display_name || '',
      role: auth.profile.role,
    });
  }

  if (action === 'summary') {
    const auth = await requireAccountingUser(request);

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    try {
      const financialYear = getFinancialYearFromRequest(request);
      const summary = await getPeriodSummary(auth.supabaseAdmin, { financialYear });
      return response.status(200).json(summary);
    } catch (error) {
      return response.status(400).json({ error: error.message || 'Could not load summary.' });
    }
  }

  if (action === 'list-income') {
    const auth = await requireAccountingUser(request);

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const { startDate, endDate } = getDateRangeFromRequest(request);

    const { data, error } = await auth.supabaseAdmin
      .from('accounting_income')
      .select('*')
      .gte('entry_date', startDate)
      .lt('entry_date', endDate)
      .order('entry_date', { ascending: false });

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({
      items: (data || []).map(mapIncomeRow),
    });
  }

  if (action === 'create-income') {
    const auth = await requireAccountingUser(request, { minRole: 'accountant' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const description = String(request.body?.description || '').trim();
    const entryDate = String(request.body?.entryDate || '').trim() || new Date().toISOString().slice(0, 10);
    const customerName = String(request.body?.customerName || '').trim();
    const category = String(request.body?.category || 'general').trim() || 'general';
    const notes = String(request.body?.notes || '').trim();
    const gstMode = String(request.body?.gstMode || 'inc').trim();
    const receiptPath = String(request.body?.receiptPath || '').trim();
    const receiptFilename = String(request.body?.receiptFilename || '').trim();

    let amounts;

    if (gstMode === 'ex') {
      amounts = combineGstFromEx(request.body?.amountExGst);
    } else {
      amounts = splitGstFromInc(request.body?.amountIncGst);
    }

    if (!description || !amounts.amountIncGst) {
      return response.status(400).json({ error: 'Description and amount are required.' });
    }

    const { data, error } = await auth.supabaseAdmin
      .from('accounting_income')
      .insert({
        entry_date: entryDate,
        description,
        customer_name: customerName || null,
        amount_ex_gst: amounts.amountExGst,
        gst_amount: amounts.gstAmount,
        amount_inc_gst: amounts.amountIncGst,
        source: 'manual',
        category,
        receipt_path: receiptPath || null,
        receipt_filename: receiptFilename || null,
        notes: notes || null,
        created_by: auth.profile.id,
      })
      .select('*')
      .single();

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({ item: mapIncomeRow(data) });
  }

  if (action === 'update-income') {
    const auth = await requireAccountingUser(request, { minRole: 'accountant' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const id = String(request.body?.id || '').trim();
    const description = String(request.body?.description || '').trim();
    const entryDate = String(request.body?.entryDate || '').trim();
    const customerName = String(request.body?.customerName || '').trim();
    const category = String(request.body?.category || 'general').trim() || 'general';
    const notes = String(request.body?.notes || '').trim();
    const gstMode = String(request.body?.gstMode || 'inc').trim();
    const receiptPath = String(request.body?.receiptPath || '').trim();
    const receiptFilename = String(request.body?.receiptFilename || '').trim();
    const clearReceipt = request.body?.clearReceipt === true;

    if (!id) {
      return response.status(400).json({ error: 'Income ID is required.' });
    }

    let amounts;

    if (gstMode === 'ex') {
      amounts = combineGstFromEx(request.body?.amountExGst);
    } else {
      amounts = splitGstFromInc(request.body?.amountIncGst);
    }

    if (!description || !amounts.amountIncGst) {
      return response.status(400).json({ error: 'Description and amount are required.' });
    }

    const updatePayload = {
      entry_date: entryDate,
      description,
      customer_name: customerName || null,
      amount_ex_gst: amounts.amountExGst,
      gst_amount: amounts.gstAmount,
      amount_inc_gst: amounts.amountIncGst,
      category,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    if (clearReceipt) {
      updatePayload.receipt_path = null;
      updatePayload.receipt_filename = null;
    } else if (receiptPath) {
      updatePayload.receipt_path = receiptPath;
      updatePayload.receipt_filename = receiptFilename || null;
    }

    const { data, error } = await auth.supabaseAdmin
      .from('accounting_income')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({ item: mapIncomeRow(data) });
  }

  if (action === 'delete-income') {
    const auth = await requireAccountingUser(request, { minRole: 'accountant' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const id = String(request.body?.id || '').trim();

    if (!id) {
      return response.status(400).json({ error: 'Income ID is required.' });
    }

    const { error } = await auth.supabaseAdmin.from('accounting_income').delete().eq('id', id);

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({ deleted: true });
  }

  if (action === 'list-expenses') {
    const auth = await requireAccountingUser(request);

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const { startDate, endDate } = getDateRangeFromRequest(request);

    const { data, error } = await auth.supabaseAdmin
      .from('accounting_expenses')
      .select('*')
      .gte('entry_date', startDate)
      .lt('entry_date', endDate)
      .order('entry_date', { ascending: false });

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({
      items: (data || []).map(mapExpenseRow),
    });
  }

  if (action === 'create-expense') {
    const auth = await requireAccountingUser(request, { minRole: 'accountant' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const supplierName = String(request.body?.supplierName || '').trim();
    const description = String(request.body?.description || '').trim();
    const entryDate = String(request.body?.entryDate || '').trim() || new Date().toISOString().slice(0, 10);
    const category = String(request.body?.category || 'general').trim() || 'general';
    const notes = String(request.body?.notes || '').trim();
    const gstClaimable = request.body?.gstClaimable !== false;
    const gstMode = String(request.body?.gstMode || 'inc').trim();
    const receiptPath = String(request.body?.receiptPath || '').trim();
    const receiptFilename = String(request.body?.receiptFilename || '').trim();

    let amounts;

    if (gstMode === 'ex') {
      amounts = combineGstFromEx(request.body?.amountExGst);
    } else {
      amounts = splitGstFromInc(request.body?.amountIncGst);
    }

    if (!supplierName || !amounts.amountIncGst) {
      return response.status(400).json({ error: 'Supplier and amount are required.' });
    }

    const { data, error } = await auth.supabaseAdmin
      .from('accounting_expenses')
      .insert({
        entry_date: entryDate,
        supplier_name: supplierName,
        description,
        amount_ex_gst: amounts.amountExGst,
        gst_amount: amounts.gstAmount,
        amount_inc_gst: amounts.amountIncGst,
        gst_claimable: gstClaimable,
        category,
        receipt_path: receiptPath || null,
        receipt_filename: receiptFilename || null,
        notes: notes || null,
        created_by: auth.profile.id,
      })
      .select('*')
      .single();

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({ item: mapExpenseRow(data) });
  }

  if (action === 'update-expense') {
    const auth = await requireAccountingUser(request, { minRole: 'accountant' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const id = String(request.body?.id || '').trim();
    const supplierName = String(request.body?.supplierName || '').trim();
    const description = String(request.body?.description || '').trim();
    const entryDate = String(request.body?.entryDate || '').trim();
    const category = String(request.body?.category || 'general').trim() || 'general';
    const notes = String(request.body?.notes || '').trim();
    const gstClaimable = request.body?.gstClaimable !== false;
    const gstMode = String(request.body?.gstMode || 'inc').trim();
    const receiptPath = String(request.body?.receiptPath || '').trim();
    const receiptFilename = String(request.body?.receiptFilename || '').trim();
    const clearReceipt = request.body?.clearReceipt === true;

    if (!id) {
      return response.status(400).json({ error: 'Expense ID is required.' });
    }

    let amounts;

    if (gstMode === 'ex') {
      amounts = combineGstFromEx(request.body?.amountExGst);
    } else {
      amounts = splitGstFromInc(request.body?.amountIncGst);
    }

    if (!supplierName || !amounts.amountIncGst) {
      return response.status(400).json({ error: 'Supplier and amount are required.' });
    }

    const updatePayload = {
      entry_date: entryDate,
      supplier_name: supplierName,
      description,
      amount_ex_gst: amounts.amountExGst,
      gst_amount: amounts.gstAmount,
      amount_inc_gst: amounts.amountIncGst,
      gst_claimable: gstClaimable,
      category,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    if (clearReceipt) {
      updatePayload.receipt_path = null;
      updatePayload.receipt_filename = null;
    } else if (receiptPath) {
      updatePayload.receipt_path = receiptPath;
      updatePayload.receipt_filename = receiptFilename || null;
    }

    const { data, error } = await auth.supabaseAdmin
      .from('accounting_expenses')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({ item: mapExpenseRow(data) });
  }

  if (action === 'delete-expense') {
    const auth = await requireAccountingUser(request, { minRole: 'accountant' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const id = String(request.body?.id || '').trim();

    if (!id) {
      return response.status(400).json({ error: 'Expense ID is required.' });
    }

    const { error } = await auth.supabaseAdmin.from('accounting_expenses').delete().eq('id', id);

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({ deleted: true });
  }

  if (action === 'list-logbook') {
    const auth = await requireAccountingUser(request);

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const { startDate, endDate } = getDateRangeFromRequest(request);

    const { data, error } = await auth.supabaseAdmin
      .from('accounting_logbook_entries')
      .select('*')
      .gte('entry_date', startDate)
      .lt('entry_date', endDate)
      .order('entry_date', { ascending: false });

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({
      items: (data || []).map(mapLogbookRow),
    });
  }

  if (action === 'create-logbook') {
    const auth = await requireAccountingUser(request, { minRole: 'accountant' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const description = String(request.body?.description || '').trim();
    const purpose = String(request.body?.purpose || '').trim();
    const entryDate = String(request.body?.entryDate || '').trim() || new Date().toISOString().slice(0, 10);
    const startLocation = String(request.body?.startLocation || '').trim();
    const endLocation = String(request.body?.endLocation || '').trim();
    const notes = String(request.body?.notes || '').trim();
    const distanceKm = request.body?.distanceKm ? Number(request.body.distanceKm) : null;

    if (!description) {
      return response.status(400).json({ error: 'Description is required.' });
    }

    const { data, error } = await auth.supabaseAdmin
      .from('accounting_logbook_entries')
      .insert({
        entry_date: entryDate,
        description,
        purpose,
        start_location: startLocation || null,
        end_location: endLocation || null,
        distance_km: distanceKm,
        notes: notes || null,
        created_by: auth.profile.id,
      })
      .select('*')
      .single();

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({ item: mapLogbookRow(data) });
  }

  if (action === 'update-logbook') {
    const auth = await requireAccountingUser(request, { minRole: 'accountant' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const id = String(request.body?.id || '').trim();
    const description = String(request.body?.description || '').trim();
    const purpose = String(request.body?.purpose || '').trim();
    const entryDate = String(request.body?.entryDate || '').trim();
    const startLocation = String(request.body?.startLocation || '').trim();
    const endLocation = String(request.body?.endLocation || '').trim();
    const notes = String(request.body?.notes || '').trim();
    const distanceKm = request.body?.distanceKm ? Number(request.body.distanceKm) : null;

    if (!id) {
      return response.status(400).json({ error: 'Log book entry ID is required.' });
    }

    if (!description) {
      return response.status(400).json({ error: 'Description is required.' });
    }

    const { data, error } = await auth.supabaseAdmin
      .from('accounting_logbook_entries')
      .update({
        entry_date: entryDate,
        description,
        purpose,
        start_location: startLocation || null,
        end_location: endLocation || null,
        distance_km: distanceKm,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({ item: mapLogbookRow(data) });
  }

  if (action === 'delete-logbook') {
    const auth = await requireAccountingUser(request, { minRole: 'accountant' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const id = String(request.body?.id || '').trim();

    if (!id) {
      return response.status(400).json({ error: 'Log book entry ID is required.' });
    }

    const { error } = await auth.supabaseAdmin
      .from('accounting_logbook_entries')
      .delete()
      .eq('id', id);

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({ deleted: true });
  }

  if (action === 'sync-stripe') {
    const auth = await requireAccountingUser(request, { minRole: 'accountant' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    try {
      const result = await syncStripeIncome({
        supabaseAdmin: auth.supabaseAdmin,
        createdBy: auth.profile.id,
        startingAfter: String(request.body?.startingAfter || '').trim(),
      });

      return response.status(200).json(result);
    } catch (error) {
      return response.status(400).json({ error: error.message || 'Stripe sync failed.' });
    }
  }

  if (action === 'list-users') {
    const auth = await requireAccountingUser(request, { minRole: 'owner' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const { data, error } = await auth.supabaseAdmin
      .from('accounting_users')
      .select('id, email, display_name, role, active, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.status(200).json({ users: data || [] });
  }

  if (action === 'invite-user') {
    const auth = await requireAccountingUser(request, { minRole: 'owner' });

    if (auth.error) {
      return response.status(auth.status).json({ error: auth.error });
    }

    const email = String(request.body?.email || '').trim().toLowerCase();
    const displayName = String(request.body?.displayName || '').trim();
    const role = String(request.body?.role || 'accountant').trim();
    const password = String(request.body?.password || '').trim();

    if (!email || !password || password.length < 8) {
      return response.status(400).json({
        error: 'Email and a password of at least 8 characters are required.',
      });
    }

    if (!['owner', 'accountant', 'viewer'].includes(role)) {
      return response.status(400).json({ error: 'Invalid role.' });
    }

    const { data: existingProfile } = await auth.supabaseAdmin
      .from('accounting_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile?.id) {
      return response.status(400).json({ error: 'That email already has access.' });
    }

    const { data: createdUser, error: createError } =
      await auth.supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) {
      return response.status(400).json({ error: createError.message });
    }

    const { data: profile, error: profileError } = await auth.supabaseAdmin
      .from('accounting_users')
      .insert({
        auth_user_id: createdUser.user.id,
        email,
        display_name: displayName || email.split('@')[0],
        role,
        invited_by: auth.profile.id,
      })
      .select('*')
      .single();

    if (profileError) {
      await auth.supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
      return response.status(400).json({ error: profileError.message });
    }

    return response.status(200).json({
      user: {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        role: profile.role,
      },
    });
  }

  return response.status(404).json({ error: 'Unknown action.' });
}
