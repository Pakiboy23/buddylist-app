import { Capacitor } from '@capacitor/core';
import { processLock } from '@supabase/auth-js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const isNativePlatform =
  typeof window !== 'undefined' && Capacitor.isNativePlatform();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: !isNativePlatform,
    ...(isNativePlatform
      ? {
          lock: processLock,
          lockAcquireTimeout: 10000,
        }
      : {}),
  },
});
