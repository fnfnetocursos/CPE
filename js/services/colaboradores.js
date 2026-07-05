/**
 * Serviços — Colaboradores e Perfis
 */
import { getSupabase } from '../supabase-client.js';

export async function listColaboradores(empresaId) {
  const supabase = getSupabase();

  const { data: colabs, error } = await supabase
    .from('colaboradores_detalhes')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('data_admissao', { ascending: false });

  if (error) throw error;
  if (!colabs?.length) return [];

  const userIds = [...new Set(colabs.map((c) => c.user_id))];
  const jornadaIds = [...new Set(colabs.map((c) => c.jornada_id).filter(Boolean))];

  const perfisPromise = supabase.from('perfis').select('id, nome, perfil').in('id', userIds);
  const jornadasPromise = jornadaIds.length
    ? supabase.from('jornadas_trabalho').select('id, descricao').in('id', jornadaIds)
    : Promise.resolve({ data: [] });

  const [perfisRes, jornadasRes] = await Promise.all([perfisPromise, jornadasPromise]);

  if (perfisRes.error) throw perfisRes.error;

  const perfilMap = Object.fromEntries((perfisRes.data || []).map((p) => [p.id, p]));
  const jornadaMap = Object.fromEntries((jornadasRes.data || []).map((j) => [j.id, j]));

  return colabs.map((c) => ({
    ...c,
    perfis: perfilMap[c.user_id] || { nome: '—' },
    jornadas_trabalho: c.jornada_id ? jornadaMap[c.jornada_id] || null : null
  }));
}

export async function listPerfisEmpresa(empresaId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('perfil', 'COLABORADOR');
  if (error) throw error;
  return data;
}

export async function createColaborador({
  email,
  senha,
  nome,
  empresa_id,
  matricula,
  jornada_id,
  data_admissao
}) {
  const supabase = getSupabase();

  const { data: signData, error: signError } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome, perfil: 'COLABORADOR', empresa_id }
    }
  });

  if (signError) throw signError;
  const userId = signData.user?.id;
  if (!userId) throw new Error('Usuário não criado. Verifique confirmação de e-mail no Supabase.');

  await supabase.from('perfis').update({ nome, perfil: 'COLABORADOR', empresa_id }).eq('id', userId);

  const { data, error } = await supabase
    .from('colaboradores_detalhes')
    .insert({
      user_id: userId,
      empresa_id,
      matricula,
      jornada_id: jornada_id || null,
      data_admissao,
      ativo: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateColaborador(id, payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('colaboradores_detalhes')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePerfilNome(userId, nome) {
  const supabase = getSupabase();
  const { error } = await supabase.from('perfis').update({ nome }).eq('id', userId);
  if (error) throw error;
}

export async function createAdminEmpresa({ email, senha, nome, empresa_id }) {
  const supabase = getSupabase();

  const { data: signData, error: signError } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome, perfil: 'ADMIN', empresa_id }
    }
  });

  if (signError) throw signError;
  const userId = signData.user?.id;
  if (!userId) throw new Error('Admin não criado.');

  const { error } = await supabase
    .from('perfis')
    .update({ nome, perfil: 'ADMIN', empresa_id })
    .eq('id', userId);

  if (error) throw error;
  return userId;
}

/** Master — todos os perfis */
export async function listAllPerfis() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('perfis').select('*').order('nome');
  if (error) throw error;
  return data;
}

/** Master — todos colaboradores */
export async function listAllColaboradores() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('colaboradores_detalhes')
    .select('*')
    .order('data_admissao', { ascending: false });
  if (error) throw error;
  return data;
}
