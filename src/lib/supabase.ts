import { createClient } from '@supabase/supabase-js';

export const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
export const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
