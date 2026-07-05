/**
 * Serviços — Colaboradores e Perfis
 */
import { getSupabase } from '../supabase-client.js';

export async function listColaboradores(empresaId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('colaboradores_detalhes')
    .select(`
      *,
      perfis:user_id (id, nome, perfil),
      jornadas_trabalho (descricao)
    `)
    .eq('empresa_id', empresaId)
    .order('data_admissao', { ascending: false });
  if (error) throw error;
  return data;
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

/**
 * Cria colaborador: signUp + atualiza perfil + insere detalhes
 * Requer confirmação de e-mail desabilitada ou fluxo de convite no Supabase
 */
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
      data: {
        nome,
        perfil: 'COLABORADOR',
        empresa_id
      }
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
