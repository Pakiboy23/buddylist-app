import { createClient } from '@supabase/supabase-js';

const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackAnonKey = 'placeholder-anon-key';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const shouldAllowFallback =
  import.meta.env.MODE !== 'production' || import.meta.env.VITE_ALLOW_SUPABASE_FALLBACK === 'true';

if ((!supabaseUrl || !supabaseAnonKey) && !shouldAllowFallback) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set public Supabase env vars for production builds.',
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
