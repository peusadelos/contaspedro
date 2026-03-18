import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mhfbrwxeiktumxvdswbi.supabase.co';
const supabaseAnonKey = 'sb_publishable_Yv3KTm_jnwnEmpbWyWoeNw_YNApGt3W';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SupabaseTransaction = {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  date: string;
  created_date: string;
  due_date: string;
  paid_date: string | null;
  category: string;
  type: string;
  is_paid: boolean;
  recurring_group: string | null;
};
