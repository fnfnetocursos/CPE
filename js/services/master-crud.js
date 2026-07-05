/**
 * CRUD global para perfil MASTER (todas as tabelas)
 */
import { getSupabase } from '../supabase-client.js';

export async function masterList(table, order = { col: 'created_at', asc: false }) {
  const supabase = getSupabase();
  let q = supabase.from(table).select('*');
  if (order?.col) q = q.order(order.col, { ascending: !!order.asc });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function masterGet(table, id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function masterInsert(table, payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function masterUpdate(table, id, payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function masterDelete(table, id) {
  const supabase = getSupabase();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

/** Atualiza perfil por user id (PK = auth.users id) */
export async function masterUpdatePerfil(userId, payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('perfis').update(payload).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

export async function masterDeletePerfil(userId) {
  const supabase = getSupabase();
  const { error } = await supabase.from('perfis').delete().eq('id', userId);
  if (error) throw error;
}

/** Cria usuário auth + perfil */
export async function masterCreateUsuario({ email, senha, nome, perfil, empresa_id }) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: {
        nome,
        perfil,
        empresa_id: empresa_id || null
      }
    }
  });
  if (error) throw error;
  if (!data.user?.id) throw new Error('Usuário não criado. Desabilite confirmação de e-mail no Supabase.');

  await supabase
    .from('perfis')
    .update({
      nome,
      perfil,
      empresa_id: empresa_id || null
    })
    .eq('id', data.user.id);

  return data.user;
}

export async function listEmpresasOptions() {
  return masterList('empresas', { col: 'razao_social', asc: true });
}

export async function listPerfisOptions() {
  return masterList('perfis', { col: 'nome', asc: true });
}

export async function listJornadasOptions() {
  return masterList('jornadas_trabalho', { col: 'descricao', asc: true });
}
