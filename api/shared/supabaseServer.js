import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function createServerSupabaseClient(url, key, options = {}) {
  const { realtime, ...rest } = options;

  return createClient(url, key, {
    ...rest,
    realtime: {
      transport: ws,
      ...realtime,
    },
  });
}

export function getSupabaseConfig() {
  return { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };
}

export function createSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase service role is not configured.');
  }

  return createServerSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createSupabaseUserClient(accessToken) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase anon key is not configured.');
  }

  return createServerSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
