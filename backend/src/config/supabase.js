import { createClient } from '@supabase/supabase-js';
import { ENV } from './env.js';

let supabaseClient = null;

if (ENV.SUPABASE_URL && (ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY)) {
  const key = ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY;
  supabaseClient = createClient(ENV.SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  console.log('✓ Supabase client initialized successfully.');
} else {
  console.warn('⚠️ Supabase credentials not found in environment. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.');
}

export const supabase = supabaseClient;
