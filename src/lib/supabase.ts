import { createClient } from '@supabase/supabase-js';

const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackAnonKey = 'placeholder-anon-key';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const shouldAllowFallback =
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_SUPABASE_FALLBACK === 'true';

if ((!supabaseUrl || !supabaseAnonKey) && !shouldAllowFallback) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set public Supabase env vars for production builds.',
  );
}

export const supabase = createClient(
  supabaseUrl ?? fallbackUrl,
  supabaseAnonKey ?? fallbackAnonKey,
  {
    auth: {
      detectSessionInUrl: false, // Capacitor doesn't use URL-based auth callbacks
      persistSession: true,
    },
  }
);
