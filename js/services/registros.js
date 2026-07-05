/**
 * Serviços — Registros de Ponto
 */
import { getSupabase } from '../supabase-client.js';
import { toLocalDateISO } from '../utils/time.js';

export async function listRegistros({ userId, empresaId, dataInicio, dataFim }) {
  const supabase = getSupabase();
  let q = supabase
    .from('registros_ponto')
    .select('*')
    .eq('empresa_id', empresaId)
    .gte('data_registro', dataInicio)
    .lte('data_registro', dataFim)
    .order('data_registro')
    .order('hora_registro');

  if (userId) q = q.eq('user_id', userId);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listRegistrosHoje(userId, empresaId) {
  const hoje = toLocalDateISO();
  return listRegistros({ userId, empresaId, dataInicio: hoje, dataFim: hoje });
}

export async function createRegistroPonto({
  user_id,
  empresa_id,
  tipo_registro,
  ip_equipamento,
  user_agent,
  nome_terminal_local,
  hora_registro,
  data_registro
}) {
  const supabase = getSupabase();
  const payload = {
    user_id,
    empresa_id,
    tipo_registro,
    ip_equipamento,
    user_agent,
    nome_terminal_local,
    data_registro: data_registro || toLocalDateISO(),
    hora_registro: hora_registro || new Date().toTimeString().slice(0, 8)
  };

  const { data, error } = await supabase.from('registros_ponto').insert(payload).select().single();
  if (error) throw error;
  return data;
}

/** Colaboradores com entrada hoje (para KPI admin) */
export async function countPresentesHoje(empresaId) {
  const supabase = getSupabase();
  const hoje = toLocalDateISO();
  const { data, error } = await supabase
    .from('registros_ponto')
    .select('user_id')
    .eq('empresa_id', empresaId)
    .eq('data_registro', hoje)
    .eq('tipo_registro', 'ENTRADA');
  if (error) throw error;
  const unique = new Set(data.map((r) => r.user_id));
  return unique.size;
}

export async function exportTable(tableName, filter = {}) {
  const supabase = getSupabase();
  let q = supabase.from(tableName).select('*');
  if (filter.empresa_id) q = q.eq('empresa_id', filter.empresa_id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
