/**
 * Serviços — Jornadas de Trabalho
 */
import { getSupabase } from '../supabase-client.js';

export async function listJornadas(empresaId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('jornadas_trabalho')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('descricao');
  if (error) throw error;
  return data;
}

export async function createJornada(payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('jornadas_trabalho').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateJornada(id, payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('jornadas_trabalho').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteJornada(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from('jornadas_trabalho').delete().eq('id', id);
  if (error) throw error;
}

export async function getJornada(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('jornadas_trabalho').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
