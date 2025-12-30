
import { createClient } from '@supabase/supabase-js';

// Credentials provided by user
const supabaseUrl = 'https://seaajftwptfsxqlcnrmq.supabase.co';
const supabaseKey = 'sb_publishable_pTdH5HIPUAjyp5XY1clnLw_AzXUdZFG';

export const supabase = createClient(supabaseUrl, supabaseKey);
