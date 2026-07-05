/**
 * Cliente Supabase singleton — lê credenciais de window.APP_CONFIG
 */
import { showToast } from './utils/ui.js';

let supabaseClient = null;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('seu-projeto')) {
    console.warn('Configure SUPABASE_URL e SUPABASE_ANON_KEY em js/config.js ou variáveis Vercel.');
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

export async function handleSupabaseError(error, context = 'Operação') {
  const msg = error?.message || 'Erro desconhecido';
  console.error(`[Supabase] ${context}:`, error);
  showToast(`${context}: ${msg}`, 'error');
  return msg;
}
