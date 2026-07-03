import { createClient } from '@supabase/supabase-js';

const normalizeEnvValue = (value: string) => value.trim().replace(/^['"]|['"]$/g, '');
const resolveSupabaseUrl = (value: string) => {
  const normalized = normalizeEnvValue(value);

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }

  // Allow using only the project ref, e.g. "abcd1234".
  if (/^[a-z0-9-]+$/i.test(normalized) && normalized.length > 8) {
    return `https://${normalized}.supabase.co`;
  }

  return normalized;
};

const supabaseUrl = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
const supabaseAnonKey = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

// Safely initialize Supabase client
// If credentials are missing or placeholders, we log a warning instead of crashing
const isConfigured = supabaseUrl.startsWith('http') && supabaseAnonKey.length > 0;

if (!isConfigured) {
  console.warn(
    'Supabase credentials are missing or invalid. Please check your .env.local file. ' +
    'The application will run in "disconnected" mode.'
  );
}

export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
