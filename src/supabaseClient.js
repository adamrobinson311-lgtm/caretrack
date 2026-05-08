import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project values
// Found in: Supabase Dashboard → Project Settings → API
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // PKCE flow defeats email-scanner pre-fetch attacks. The reset email
    // contains a code that only the user's browser can exchange for a
    // session — a passive GET by a security scanner can't redeem it, so
    // the link stays valid until the user actually clicks it.
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
