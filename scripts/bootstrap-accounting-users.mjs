/**
 * One-time bootstrap for COSA Accounting users.
 * Usage (from cosa-accounting folder):
 *   $env:SUPABASE_URL="https://..."
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..."
 *   node scripts/bootstrap-accounting-users.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const OWNER_EMAIL = 'caleb@cosa.net.au';
const OWNER_NAME = 'Caleb';
const ACCOUNTANT_EMAIL = 'Sean@Simphill.com';
const ACCOUNTANT_NAME = 'Sean';
const ACCOUNTANT_PASSWORD = 'testtest';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAuthUserByEmail(email) {
  let page = 1;
  const normalized = email.toLowerCase();

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw error;
    }

    const match = (data?.users || []).find(
      (user) => String(user.email || '').toLowerCase() === normalized,
    );

    if (match) {
      return match;
    }

    if (!data?.users?.length || data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return null;
}

async function ensureAccountingUser({ authUserId, email, displayName, role }) {
  const { data: existing, error: existingError } = await supabase
    .from('accounting_users')
    .select('id, email, role')
    .eq('email', email)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('accounting_users')
      .update({
        auth_user_id: authUserId,
        display_name: displayName,
        role,
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) {
      throw updateError;
    }

    return { action: 'updated', email, role };
  }

  const { error: insertError } = await supabase.from('accounting_users').insert({
    auth_user_id: authUserId,
    email,
    display_name: displayName,
    role,
    active: true,
  });

  if (insertError) {
    throw insertError;
  }

  return { action: 'created', email, role };
}

async function ensureAuthUser({ email, password, displayName }) {
  const existing = await findAuthUserByEmail(email);

  if (existing) {
    if (password) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });

      if (error) {
        throw error;
      }
    }

    return { user: existing, action: password ? 'updated-password' : 'found' };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error) {
    throw error;
  }

  return { user: data.user, action: 'created' };
}

async function main() {
  console.log('Bootstrapping COSA Accounting users...');

  const ownerAuth = await ensureAuthUser({
    email: OWNER_EMAIL,
    displayName: OWNER_NAME,
  });

  const ownerProfile = await ensureAccountingUser({
    authUserId: ownerAuth.user.id,
    email: OWNER_EMAIL,
    displayName: OWNER_NAME,
    role: 'owner',
  });

  console.log(`Owner auth: ${ownerAuth.action} (${OWNER_EMAIL})`);
  console.log(`Owner profile: ${ownerProfile.action}`);

  const accountantAuth = await ensureAuthUser({
    email: ACCOUNTANT_EMAIL,
    password: ACCOUNTANT_PASSWORD,
    displayName: ACCOUNTANT_NAME,
  });

  const accountantProfile = await ensureAccountingUser({
    authUserId: accountantAuth.user.id,
    email: ACCOUNTANT_EMAIL,
    displayName: ACCOUNTANT_NAME,
    role: 'accountant',
  });

  console.log(`Accountant auth: ${accountantAuth.action} (${ACCOUNTANT_EMAIL})`);
  console.log(`Accountant profile: ${accountantProfile.action}`);
  console.log('Done.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
