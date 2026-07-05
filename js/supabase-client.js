/**
 * Cliente Supabase singleton — lê credenciais de window.APP_CONFIG
 */
import { showToast } from './utils/ui.js';

let supabaseClient = null;

/** Valida configuração antes de qualquer chamada à API */
export function validateConfig() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY nas variáveis de ambiente da Vercel e faça redeploy.'
    );
  }

  if (
    SUPABASE_URL.includes('seu-projeto') ||
    SUPABASE_ANON_KEY.includes('sua-chave') ||
    SUPABASE_ANON_KEY.length < 20
  ) {
    throw new Error(
      'Credenciais Supabase inválidas ou ainda padrão. Verifique o build da Vercel e js/config.js.'
    );
  }

  if (!window.supabase?.createClient) {
    throw new Error(
      'Biblioteca Supabase não carregou. Verifique bloqueador de anúncios ou conexão com cdn.jsdelivr.net.'
    );
  }
}

export function getSupabase() {
  if (supabaseClient) return supabaseClient;

  validateConfig();

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

export async function handleSupabaseError(error, context = 'Operação') {
  const msg = error?.message || 'Erro desconhecido';
  console.error(`[Supabase] ${context}:`, error);
  showToast(`${context}: ${msg}`, 'error');
  return msg;
}

/** Mensagem amigável para erros comuns de autenticação */
export function formatAuthError(error) {
  const msg = error?.message || '';
  if (msg.includes('Invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'E-mail não confirmado. Desabilite confirmação de e-mail no Supabase (Authentication → Providers → Email).';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Não foi possível conectar ao Supabase. Verifique URL, chave anon e CORS.';
  }
  return msg || 'Falha na autenticação.';
}
