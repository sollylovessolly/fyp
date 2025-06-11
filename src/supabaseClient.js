
import { createClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials (WARNING: Rotate keys before production)
const supabaseUrl = 'https://larddhanibbtavbwhnha.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcmRkaGFuaWJidGF2YndobmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMDQwMzMsImV4cCI6MjA2NDg4MDAzM30.YxNJ8inCyKkJatMc9axX8Vo0GC1Hnx8Gp0OXjAt0XxA';

// Debug credentials
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Present' : 'Missing');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);