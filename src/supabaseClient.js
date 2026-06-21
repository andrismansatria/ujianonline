import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'dosen2026'

export const APP_NAME = 'Ujian Teknik Sipil'
export const UNIVERSITY = 'Universitas Teuku Umar'
export const FACULTY = 'Fakultas Teknik • Prodi Teknik Sipil'
