/**
 * Autenticação e gerenciamento de sessão/perfil
 */
import { getSupabase, handleSupabaseError, formatAuthError } from './supabase-client.js';

export const state = {
  user: null,
  perfil: null,
  colaboradorDetalhe: null,
  empresa: null
};

export async function login(email, senha) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) throw new Error(formatAuthError(error));

  if (!data?.user) {
    throw new Error('Login não retornou usuário.');
  }

  state.user = data.user;
  await loadPerfil();
  return state.perfil;
}

export async function logout() {
  const supabase = getSupabase();
  await supabase.auth.signOut();
  state.user = null;
  state.perfil = null;
  state.colaboradorDetalhe = null;
  state.empresa = null;
}

export async function loadPerfil() {
  const supabase = getSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!user) {
    state.user = null;
    state.perfil = null;
    state.empresa = null;
    return null;
  }

  state.user = user;

  const { data: perfil, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    await handleSupabaseError(error, 'Carregar perfil');
    throw new Error(`Erro ao carregar perfil: ${error.message}`);
  }

  if (!perfil) {
    throw new Error('Usuário sem perfil. Execute sql/seed-dados-demo.sql no Supabase.');
  }

  state.perfil = perfil;

  if (perfil.empresa_id) {
    const { data: empresa, error: empError } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', perfil.empresa_id)
      .maybeSingle();

    if (empError) console.warn('Empresa não carregada:', empError.message);
    state.empresa = empresa || null;
  } else {
    state.empresa = null;
  }

  if (perfil.perfil === 'COLABORADOR' && perfil.empresa_id) {
    const { data: det } = await supabase
      .from('colaboradores_detalhes')
      .select('*')
      .eq('user_id', user.id)
      .eq('empresa_id', perfil.empresa_id)
      .maybeSingle();
    state.colaboradorDetalhe = det;
  } else {
    state.colaboradorDetalhe = null;
  }

  if (window.__CPE_SESSION__) {
    window.__CPE_SESSION__.user = user;
    window.__CPE_SESSION__.perfil = perfil;
    window.__CPE_SESSION__.empresaNome = state.empresa?.razao_social || null;
  }

  return perfil;
}

export async function initSession() {
  const supabase = getSupabase();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) throw error;

  if (session?.user) {
    state.user = session.user;
    await loadPerfil();
    return state.perfil;
  }
  return null;
}

export function getEmpresaId() {
  return state.perfil?.empresa_id || null;
}

export function isMaster() {
  return state.perfil?.perfil === 'MASTER';
}

export function isAdmin() {
  return state.perfil?.perfil === 'ADMIN';
}

export function isColaborador() {
  return state.perfil?.perfil === 'COLABORADOR';
}
