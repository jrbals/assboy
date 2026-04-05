import { createClient } from '@supabase/supabase-js';
import { supabase as config } from './config';

export const supabase = createClient(config.url, config.anonKey);
export const supabaseAdmin = createClient(config.url, config.serviceRoleKey);
