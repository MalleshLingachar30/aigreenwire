import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client (uses service_role key — bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Health-check helper
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from("subscribers").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}
