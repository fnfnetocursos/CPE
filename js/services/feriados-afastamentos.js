/**
 * Serviços — Feriados e Afastamentos
 */
import { getSupabase } from '../supabase-client.js';

export async function listFeriados(empresaId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('feriados')
    .select('*')
    .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
    .order('data_feriado');
  if (error) throw error;
  return data;
}

export async function createFeriado(payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('feriados').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFeriado(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from('feriados').delete().eq('id', id);
  if (error) throw error;
}

export async function listAfastamentos(empresaId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('afastamentos')
    .select('*, perfis:user_id(nome)')
    .eq('empresa_id', empresaId)
    .order('data_inicio', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createAfastamento(payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('afastamentos').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateAfastamento(id, payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('afastamentos').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAfastamento(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from('afastamentos').delete().eq('id', id);
  if (error) throw error;
}
