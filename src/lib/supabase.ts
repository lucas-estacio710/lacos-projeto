import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL não está definida')
}

if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY não está definida')
}

if (!supabaseUrl.startsWith('https://')) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL deve começar com https://')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)