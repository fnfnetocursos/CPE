/**
 * Serviços de acesso ao banco — Empresas
 */
import { getSupabase, handleSupabaseError } from '../supabase-client.js';

export async function listEmpresas() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('empresas').select('*').order('razao_social');
  if (error) throw error;
  return data;
}

export async function createEmpresa({ razao_social, cnpj, email_admin }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('empresas')
    .insert({ razao_social, cnpj, email_admin })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmpresa(id, payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('empresas').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEmpresa(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from('empresas').delete().eq('id', id);
  if (error) throw error;
}

export async function getEmpresa(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('empresas').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
