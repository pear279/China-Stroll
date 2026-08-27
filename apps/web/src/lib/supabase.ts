import { createClient } from "@supabase/supabase-js"
import type { Database } from "../../../../supabase/database.types"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const hasSupabaseConfig = Boolean(url && key && !key.includes("replace-with"))

export const supabase = hasSupabaseConfig
  ? createClient<Database>(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
