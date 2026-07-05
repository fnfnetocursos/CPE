/**
 * Autenticação e gerenciamento de sessão/perfil
 */
import { getSupabase, handleSupabaseError } from './supabase-client.js';

/** Estado global da sessão */
export const state = {
  user: null,
  perfil: null,
  colaboradorDetalhe: null,
  empresa: null
};

export async function login(email, senha) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    state.user = null;
    state.perfil = null;
    return null;
  }

  state.user = user;

  const { data: perfil, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    await handleSupabaseError(error, 'Carregar perfil');
    throw error;
  }

  state.perfil = perfil;

  if (perfil.empresa_id) {
    const { data: empresa } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', perfil.empresa_id)
      .single();
    state.empresa = empresa;
  } else {
    state.empresa = null;
  }

  if (perfil.perfil === 'COLABORADOR' && perfil.empresa_id) {
    const { data: det } = await supabase
      .from('colaboradores_detalhes')
      .select('*, jornadas_trabalho(*)')
      .eq('user_id', user.id)
      .eq('empresa_id', perfil.empresa_id)
      .maybeSingle();
    state.colaboradorDetalhe = det;
  }

  return perfil;
}

export async function initSession() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
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
