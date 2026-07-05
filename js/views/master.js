/**
 * View Master — CRUD completo em todas as tabelas
 */
import { state } from '../auth.js';
import * as empresasSvc from '../services/empresas.js';
import { createAdminEmpresa } from '../services/colaboradores.js';
import { exportTable } from '../services/registros.js';
import * as mc from '../services/master-crud.js';
import { openModal, closeModal, showToast, $ } from '../utils/ui.js';
import { rowsToCSV, downloadCSV } from '../utils/csv.js';
import { formatDateBR, formatTimeShort, toLocalDateISO } from '../utils/time.js';

const TITLES = {
  'master-empresas': 'Empresas',
  'master-perfis': 'Usuários (Perfis)',
  'master-colaboradores': 'Colaboradores',
  'master-jornadas': 'Jornadas de Trabalho',
  'master-feriados': 'Feriados',
  'master-afastamentos': 'Afastamentos',
  'master-registros': 'Registros de Ponto',
  'master-backup': 'Backup CSV'
};

const TIPOS_PONTO = ['ENTRADA', 'SAIDA_ALMOCO', 'RETORNO_ALMOCO', 'SAIDA', 'HORAS_EXTRA'];
const PERFIS = ['MASTER', 'ADMIN', 'COLABORADOR'];

let bound = false;
let cacheEmpresas = [];
let cachePerfis = [];

function actionBtns(editFn, delFn, id) {
  return `<button class="btn btn-sm btn-outline btn-m-edit" data-fn="${editFn}" data-id="${id}">Editar</button>
    <button class="btn btn-sm btn-danger btn-m-del" data-fn="${delFn}" data-id="${id}">Excluir</button>`;
}

function bindTableActions(container, handlers) {
  container.querySelectorAll('.btn-m-edit').forEach((b) => {
    b.addEventListener('click', () => handlers[b.dataset.fn]?.(b.dataset.id));
  });
  container.querySelectorAll('.btn-m-del').forEach((b) => {
    b.addEventListener('click', () => handlers[b.dataset.fn]?.(b.dataset.id));
  });
}

async function empresaSelectHtml(selectedId, allowEmpty = true) {
  cacheEmpresas = await mc.listEmpresasOptions();
  let opts = allowEmpty ? '<option value="">— Nenhuma (global) —</option>' : '';
  opts += cacheEmpresas
    .map((e) => `<option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${e.razao_social}</option>`)
    .join('');
  return `<select id="m-empresa-id" class="form-control">${opts}</select>`;
}

async function perfilSelectHtml(selectedId, filterPerfil = null) {
  cachePerfis = await mc.listPerfisOptions();
  let list = cachePerfis;
  if (filterPerfil) list = list.filter((p) => p.perfil === filterPerfil);
  const opts = list
    .map((p) => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.nome} (${p.perfil})</option>`)
    .join('');
  return `<select id="m-user-id" class="form-control"><option value="">Selecione...</option>${opts}</select>`;
}

function empresaNome(id) {
  const e = cacheEmpresas.find((x) => x.id === id);
  return e?.razao_social || (id ? id.slice(0, 8) + '…' : 'Global');
}

function perfilNome(id) {
  const p = cachePerfis.find((x) => x.id === id);
  return p?.nome || (id ? id.slice(0, 8) + '…' : '—');
}

export function initMaster() {
  $('#master-user-info').textContent = `${state.perfil?.nome || ''} · MASTER`;

  if (!bound) {
    bound = true;

    $('#btn-nova-empresa')?.addEventListener('click', () => showFormEmpresa());
    $('#btn-master-novo-perfil')?.addEventListener('click', () => showFormPerfil());
    $('#btn-master-novo-colaborador')?.addEventListener('click', () => showFormColaborador());
    $('#btn-master-nova-jornada')?.addEventListener('click', () => showFormJornada());
    $('#btn-master-novo-feriado')?.addEventListener('click', () => showFormFeriado());
    $('#btn-master-novo-afastamento')?.addEventListener('click', () => showFormAfastamento());
    $('#btn-master-novo-registro')?.addEventListener('click', () => showFormRegistro());

    $('#btn-logout-master')?.addEventListener('click', () =>
      window.dispatchEvent(new CustomEvent('app:logout'))
    );

    document.querySelectorAll('[data-export]').forEach((btn) => {
      btn.addEventListener('click', () => exportGlobal(btn.dataset.export));
    });

    window.addEventListener('cpe:view-changed', (e) => {
      const view = e.detail?.view;
      if (view?.startsWith('master-')) onMasterView(view);
    });
  }

  onMasterView('master-empresas');
}

function onMasterView(view) {
  const loaders = {
    'master-empresas': loadEmpresas,
    'master-perfis': loadPerfis,
    'master-colaboradores': loadColaboradores,
    'master-jornadas': loadJornadas,
    'master-feriados': loadFeriados,
    'master-afastamentos': loadAfastamentos,
    'master-registros': loadRegistros
  };
  loaders[view]?.();
}

// ─── EMPRESAS ───────────────────────────────────────────────
async function loadEmpresas() {
  const tbody = $('#table-empresas tbody');
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
  try {
    cacheEmpresas = await empresasSvc.listEmpresas();
    if (!cacheEmpresas.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhuma empresa.</td></tr>';
      return;
    }
    tbody.innerHTML = cacheEmpresas
      .map(
        (e) => `<tr>
        <td>${e.razao_social}</td><td>${e.cnpj}</td><td>${e.email_admin || '—'}</td>
        <td>${formatDateBR(e.created_at?.slice(0, 10))}</td>
        <td>${actionBtns('editEmpresa', 'delEmpresa', e.id)}</td></tr>`
      )
      .join('');
    bindTableActions(tbody, { editEmpresa, delEmpresa });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Erro: ${err.message}</td></tr>`;
  }
}

function showFormEmpresa(empresa = null) {
  const isEdit = !!empresa;
  openModal({
    title: isEdit ? 'Editar Empresa' : 'Nova Empresa',
    bodyHtml: `
      <div class="form-group"><label>Razão Social *</label><input id="m-razao" class="form-control" value="${empresa?.razao_social || ''}"></div>
      <div class="form-group"><label>CNPJ *</label><input id="m-cnpj" class="form-control" value="${empresa?.cnpj || ''}"></div>
      <div class="form-group"><label>E-mail Admin</label><input id="m-email-admin" type="email" class="form-control" value="${empresa?.email_admin || ''}"></div>
      ${!isEdit ? `<hr><p style="font-size:0.85rem;color:var(--color-text-muted)">Opcional: criar ADMIN ao salvar</p>
      <div class="form-group"><label>Nome Admin</label><input id="m-admin-nome" class="form-control"></div>
      <div class="form-group"><label>Senha Admin</label><input id="m-admin-senha" type="password" class="form-control"></div>` : ''}`,
    footerButtons: [
      { label: 'Cancelar', className: 'btn btn-outline', onClick: closeModal },
      {
        label: 'Salvar',
        className: 'btn btn-primary',
        onClick: async () => {
          try {
            const payload = {
              razao_social: $('#m-razao').value.trim(),
              cnpj: $('#m-cnpj').value.trim(),
              email_admin: $('#m-email-admin').value.trim()
            };
            if (isEdit) await empresasSvc.updateEmpresa(empresa.id, payload);
            else {
              const nova = await empresasSvc.createEmpresa(payload);
              const n = $('#m-admin-nome')?.value.trim();
              const s = $('#m-admin-senha')?.value;
              if (n && s && payload.email_admin) {
                await createAdminEmpresa({ email: payload.email_admin, senha: s, nome: n, empresa_id: nova.id });
              }
            }
            closeModal();
            showToast('Empresa salva.', 'success');
            loadEmpresas();
          } catch (e) {
            showToast(e.message, 'error');
          }
        }
      }
    ]
  });
}

async function editEmpresa(id) {
  showFormEmpresa(await empresasSvc.getEmpresa(id));
}

async function delEmpresa(id) {
  if (!confirm('Excluir empresa e dados vinculados?')) return;
  try {
    await empresasSvc.deleteEmpresa(id);
    showToast('Excluída.', 'success');
    loadEmpresas();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── PERFIS ───────────────────────────────────────────────
async function loadPerfis() {
  const tbody = $('#table-master-perfis tbody');
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
  try {
    cacheEmpresas = await mc.listEmpresasOptions();
    const rows = await mc.masterList('perfis', { col: 'nome', asc: true });
    cachePerfis = rows;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhum usuário.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (p) => `<tr>
        <td>${p.nome}</td><td>${p.perfil}</td><td>${empresaNome(p.empresa_id)}</td>
        <td>${formatDateBR(String(p.created_at || '').slice(0, 10))}</td>
        <td>${actionBtns('editPerfil', 'delPerfil', p.id)}</td></tr>`
      )
      .join('');
    bindTableActions(tbody, { editPerfil, delPerfil });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Erro: ${err.message}</td></tr>`;
  }
}

async function showFormPerfil(row = null) {
  const isEdit = !!row;
  const empSelect = await empresaSelectHtml(row?.empresa_id);
  const perfilOpts = PERFIS.map(
    (p) => `<option value="${p}" ${row?.perfil === p ? 'selected' : ''}>${p}</option>`
  ).join('');

  openModal({
    title: isEdit ? 'Editar Usuário' : 'Novo Usuário',
    bodyHtml: `
      ${!isEdit ? `<div class="form-group"><label>E-mail *</label><input id="m-email" type="email" class="form-control"></div>
      <div class="form-group"><label>Senha *</label><input id="m-senha" type="password" class="form-control" value="123456"></div>` : ''}
      <div class="form-group"><label>Nome *</label><input id="m-nome" class="form-control" value="${row?.nome || ''}"></div>
      <div class="form-group"><label>Perfil *</label><select id="m-perfil" class="form-control">${perfilOpts}</select></div>
      <div class="form-group"><label>Empresa</label>${empSelect}</div>`,
    footerButtons: [
      { label: 'Cancelar', className: 'btn btn-outline', onClick: closeModal },
      {
        label: 'Salvar',
        className: 'btn btn-primary',
        onClick: async () => {
          try {
            const payload = {
              nome: $('#m-nome').value.trim(),
              perfil: $('#m-perfil').value,
              empresa_id: $('#m-empresa-id').value || null
            };
            if (isEdit) {
              await mc.masterUpdatePerfil(row.id, payload);
            } else {
              await mc.masterCreateUsuario({
                email: $('#m-email').value.trim(),
                senha: $('#m-senha').value,
                ...payload
              });
            }
            closeModal();
            showToast('Usuário salvo.', 'success');
            loadPerfis();
          } catch (e) {
            showToast(e.message, 'error');
          }
        }
      }
    ]
  });
}

async function editPerfil(id) {
  const rows = await mc.masterList('perfis');
  showFormPerfil(rows.find((p) => p.id === id));
}

async function delPerfil(id) {
  if (!confirm('Excluir perfil? (O login auth permanece no Supabase)')) return;
  try {
    await mc.masterDeletePerfil(id);
    showToast('Perfil excluído.', 'success');
    loadPerfis();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── COLABORADORES ──────────────────────────────────────────
async function loadColaboradores() {
  const tbody = $('#table-master-colaboradores tbody');
  tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
  try {
    cacheEmpresas = await mc.listEmpresasOptions();
    cachePerfis = await mc.listPerfisOptions();
    const rows = await mc.masterList('colaboradores_detalhes', { col: 'data_admissao', asc: false });
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhum colaborador.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (c) => `<tr>
        <td>${c.matricula || '—'}</td><td>${perfilNome(c.user_id)}</td><td>${empresaNome(c.empresa_id)}</td>
        <td>${formatDateBR(c.data_admissao)}</td><td>${c.ativo ? 'Sim' : 'Não'}</td>
        <td>${actionBtns('editColaborador', 'delColaborador', c.id)}</td></tr>`
      )
      .join('');
    bindTableActions(tbody, { editColaborador, delColaborador });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Erro: ${err.message}</td></tr>`;
  }
}

async function showFormColaborador(row = null) {
  const isEdit = !!row;
  const userSelect = await perfilSelectHtml(row?.user_id, 'COLABORADOR');
  const empSelect = await empresaSelectHtml(row?.empresa_id, false);
  const jornadas = await mc.listJornadasOptions();
  const jorOpts = jornadas
    .map((j) => `<option value="${j.id}" ${row?.jornada_id === j.id ? 'selected' : ''}>${j.descricao}</option>`)
    .join('');

  openModal({
    title: isEdit ? 'Editar Colaborador' : 'Novo Colaborador',
    bodyHtml: `
      <div class="form-group"><label>Usuário (perfil COLABORADOR) *</label>${userSelect}</div>
      <div class="form-group"><label>Empresa *</label>${empSelect}</div>
      <div class="form-group"><label>Matrícula</label><input id="m-matricula" class="form-control" value="${row?.matricula || ''}"></div>
      <div class="form-group"><label>Jornada</label><select id="m-jornada-id" class="form-control"><option value="">—</option>${jorOpts}</select></div>
      <div class="form-group"><label>Data Admissão *</label><input id="m-admissao" type="date" class="form-control" value="${row?.data_admissao || toLocalDateISO()}"></div>
      <div class="form-group form-check"><input type="checkbox" id="m-ativo" ${row?.ativo !== false ? 'checked' : ''}> <label for="m-ativo">Ativo</label></div>`,
    footerButtons: [
      { label: 'Cancelar', className: 'btn btn-outline', onClick: closeModal },
      {
        label: 'Salvar',
        className: 'btn btn-primary',
        onClick: async () => {
          try {
            const payload = {
              user_id: $('#m-user-id').value,
              empresa_id: $('#m-empresa-id').value,
              matricula: $('#m-matricula').value.trim(),
              jornada_id: $('#m-jornada-id').value || null,
              data_admissao: $('#m-admissao').value,
              ativo: $('#m-ativo').checked
            };
            if (isEdit) await mc.masterUpdate('colaboradores_detalhes', row.id, payload);
            else await mc.masterInsert('colaboradores_detalhes', payload);
            closeModal();
            showToast('Colaborador salvo.', 'success');
            loadColaboradores();
          } catch (e) {
            showToast(e.message, 'error');
          }
        }
      }
    ]
  });
}

async function editColaborador(id) {
  showFormColaborador(await mc.masterGet('colaboradores_detalhes', id));
}

async function delColaborador(id) {
  if (!confirm('Excluir colaborador?')) return;
  try {
    await mc.masterDelete('colaboradores_detalhes', id);
    showToast('Excluído.', 'success');
    loadColaboradores();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── JORNADAS ───────────────────────────────────────────────
async function loadJornadas() {
  const tbody = $('#table-master-jornadas tbody');
  tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
  try {
    cacheEmpresas = await mc.listEmpresasOptions();
    const rows = await mc.masterList('jornadas_trabalho', { col: 'descricao', asc: true });
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhuma jornada.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (j) => `<tr>
        <td>${j.descricao}</td><td>${empresaNome(j.empresa_id)}</td>
        <td>${formatTimeShort(j.entrada_prevista)}</td><td>${formatTimeShort(j.saida_prevista)}</td>
        <td>${j.carga_diaria_minutos}</td>
        <td>${actionBtns('editJornada', 'delJornada', j.id)}</td></tr>`
      )
      .join('');
    bindTableActions(tbody, { editJornada, delJornada });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Erro: ${err.message}</td></tr>`;
  }
}

async function showFormJornada(row = null) {
  const empSelect = await empresaSelectHtml(row?.empresa_id, false);
  openModal({
    title: row ? 'Editar Jornada' : 'Nova Jornada',
    bodyHtml: `
      <div class="form-group"><label>Empresa *</label>${empSelect}</div>
      <div class="form-group"><label>Descrição *</label><input id="m-desc" class="form-control" value="${row?.descricao || ''}"></div>
      <div class="form-row">
        <div class="form-group"><label>Entrada</label><input id="m-entrada" type="time" class="form-control" value="${formatTimeShort(row?.entrada_prevista) || '08:00'}"></div>
        <div class="form-group"><label>Saída</label><input id="m-saida" type="time" class="form-control" value="${formatTimeShort(row?.saida_prevista) || '17:00'}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Carga (min)</label><input id="m-carga" type="number" class="form-control" value="${row?.carga_diaria_minutos ?? 480}"></div>
        <div class="form-group"><label>Tolerância (min)</label><input id="m-tolerancia" type="number" class="form-control" value="${row?.tolerancia_minutos ?? 10}"></div>
      </div>`,
    footerButtons: [
      { label: 'Cancelar', className: 'btn btn-outline', onClick: closeModal },
      {
        label: 'Salvar',
        className: 'btn btn-primary',
        onClick: async () => {
          try {
            const payload = {
              empresa_id: $('#m-empresa-id').value,
              descricao: $('#m-desc').value.trim(),
              entrada_prevista: $('#m-entrada').value + ':00',
              saida_prevista: $('#m-saida').value + ':00',
              carga_diaria_minutos: parseInt($('#m-carga').value, 10),
              tolerancia_minutos: parseInt($('#m-tolerancia').value, 10)
            };
            if (row) await mc.masterUpdate('jornadas_trabalho', row.id, payload);
            else await mc.masterInsert('jornadas_trabalho', payload);
            closeModal();
            showToast('Jornada salva.', 'success');
            loadJornadas();
          } catch (e) {
            showToast(e.message, 'error');
          }
        }
      }
    ]
  });
}

async function editJornada(id) {
  showFormJornada(await mc.masterGet('jornadas_trabalho', id));
}

async function delJornada(id) {
  if (!confirm('Excluir jornada?')) return;
  try {
    await mc.masterDelete('jornadas_trabalho', id);
    showToast('Excluída.', 'success');
    loadJornadas();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── FERIADOS ───────────────────────────────────────────────
async function loadFeriados() {
  const tbody = $('#table-master-feriados tbody');
  tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
  try {
    cacheEmpresas = await mc.listEmpresasOptions();
    const rows = await mc.masterList('feriados', { col: 'data_feriado', asc: true });
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">Nenhum feriado.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (f) => `<tr>
        <td>${formatDateBR(f.data_feriado)}</td><td>${f.descricao}</td>
        <td>${f.empresa_id ? empresaNome(f.empresa_id) : 'Nacional'}</td>
        <td>${actionBtns('editFeriado', 'delFeriado', f.id)}</td></tr>`
      )
      .join('');
    bindTableActions(tbody, { editFeriado, delFeriado });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">Erro: ${err.message}</td></tr>`;
  }
}

async function showFormFeriado(row = null) {
  const empSelect = await empresaSelectHtml(row?.empresa_id);
  openModal({
    title: row ? 'Editar Feriado' : 'Novo Feriado',
    bodyHtml: `
      <div class="form-group"><label>Data *</label><input id="m-data" type="date" class="form-control" value="${row?.data_feriado || ''}"></div>
      <div class="form-group"><label>Descrição *</label><input id="m-desc" class="form-control" value="${row?.descricao || ''}"></div>
      <div class="form-group"><label>Empresa (vazio = nacional)</label>${empSelect}</div>`,
    footerButtons: [
      { label: 'Cancelar', className: 'btn btn-outline', onClick: closeModal },
      {
        label: 'Salvar',
        className: 'btn btn-primary',
        onClick: async () => {
          try {
            const payload = {
              data_feriado: $('#m-data').value,
              descricao: $('#m-desc').value.trim(),
              empresa_id: $('#m-empresa-id').value || null
            };
            if (row) await mc.masterUpdate('feriados', row.id, payload);
            else await mc.masterInsert('feriados', payload);
            closeModal();
            showToast('Feriado salvo.', 'success');
            loadFeriados();
          } catch (e) {
            showToast(e.message, 'error');
          }
        }
      }
    ]
  });
}

async function editFeriado(id) {
  showFormFeriado(await mc.masterGet('feriados', id));
}

async function delFeriado(id) {
  if (!confirm('Excluir feriado?')) return;
  try {
    await mc.masterDelete('feriados', id);
    showToast('Excluído.', 'success');
    loadFeriados();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── AFASTAMENTOS ───────────────────────────────────────────
async function loadAfastamentos() {
  const tbody = $('#table-master-afastamentos tbody');
  tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
  try {
    cachePerfis = await mc.listPerfisOptions();
    const rows = await mc.masterList('afastamentos', { col: 'data_inicio', asc: false });
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhum afastamento.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (a) => `<tr>
        <td>${perfilNome(a.user_id)}</td><td>${formatDateBR(a.data_inicio)}</td><td>${formatDateBR(a.data_fim)}</td>
        <td>${a.motivo}</td><td>${a.abonado ? 'Sim' : 'Não'}</td>
        <td>${actionBtns('editAfastamento', 'delAfastamento', a.id)}</td></tr>`
      )
      .join('');
    bindTableActions(tbody, { editAfastamento, delAfastamento });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Erro: ${err.message}</td></tr>`;
  }
}

async function showFormAfastamento(row = null) {
  const userSelect = await perfilSelectHtml(row?.user_id);
  const empSelect = await empresaSelectHtml(row?.empresa_id, false);
  openModal({
    title: row ? 'Editar Afastamento' : 'Novo Afastamento',
    bodyHtml: `
      <div class="form-group"><label>Colaborador *</label>${userSelect}</div>
      <div class="form-group"><label>Empresa *</label>${empSelect}</div>
      <div class="form-row">
        <div class="form-group"><label>Início *</label><input id="m-inicio" type="date" class="form-control" value="${row?.data_inicio || ''}"></div>
        <div class="form-group"><label>Fim *</label><input id="m-fim" type="date" class="form-control" value="${row?.data_fim || ''}"></div>
      </div>
      <div class="form-group"><label>Motivo *</label><input id="m-motivo" class="form-control" value="${row?.motivo || ''}"></div>
      <div class="form-group form-check"><input type="checkbox" id="m-abonado" ${row?.abonado !== false ? 'checked' : ''}> <label for="m-abonado">Abonado</label></div>`,
    footerButtons: [
      { label: 'Cancelar', className: 'btn btn-outline', onClick: closeModal },
      {
        label: 'Salvar',
        className: 'btn btn-primary',
        onClick: async () => {
          try {
            const payload = {
              user_id: $('#m-user-id').value,
              empresa_id: $('#m-empresa-id').value,
              data_inicio: $('#m-inicio').value,
              data_fim: $('#m-fim').value,
              motivo: $('#m-motivo').value.trim(),
              abonado: $('#m-abonado').checked
            };
            if (row) await mc.masterUpdate('afastamentos', row.id, payload);
            else await mc.masterInsert('afastamentos', payload);
            closeModal();
            showToast('Afastamento salvo.', 'success');
            loadAfastamentos();
          } catch (e) {
            showToast(e.message, 'error');
          }
        }
      }
    ]
  });
}

async function editAfastamento(id) {
  showFormAfastamento(await mc.masterGet('afastamentos', id));
}

async function delAfastamento(id) {
  if (!confirm('Excluir afastamento?')) return;
  try {
    await mc.masterDelete('afastamentos', id);
    showToast('Excluído.', 'success');
    loadAfastamentos();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── REGISTROS DE PONTO ─────────────────────────────────────
async function loadRegistros() {
  const tbody = $('#table-master-registros tbody');
  tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
  try {
    cachePerfis = await mc.listPerfisOptions();
    const rows = await mc.masterList('registros_ponto', { col: 'data_registro', asc: false });
    const recent = rows.slice(0, 150);
    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhum registro.</td></tr>';
      return;
    }
    tbody.innerHTML = recent
      .map(
        (r) => `<tr>
        <td>${formatDateBR(r.data_registro)}</td><td>${formatTimeShort(r.hora_registro)}</td>
        <td>${r.tipo_registro}</td><td>${perfilNome(r.user_id)}</td>
        <td>${r.nome_terminal_local || '—'}</td>
        <td>${actionBtns('editRegistro', 'delRegistro', r.id)}</td></tr>`
      )
      .join('');
    bindTableActions(tbody, { editRegistro, delRegistro });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Erro: ${err.message}</td></tr>`;
  }
}

async function showFormRegistro(row = null) {
  const userSelect = await perfilSelectHtml(row?.user_id);
  const empSelect = await empresaSelectHtml(row?.empresa_id, false);
  const tipoOpts = TIPOS_PONTO.map(
    (t) => `<option value="${t}" ${row?.tipo_registro === t ? 'selected' : ''}>${t}</option>`
  ).join('');

  openModal({
    title: row ? 'Editar Registro' : 'Novo Registro de Ponto',
    bodyHtml: `
      <div class="form-group"><label>Usuário *</label>${userSelect}</div>
      <div class="form-group"><label>Empresa *</label>${empSelect}</div>
      <div class="form-row">
        <div class="form-group"><label>Data *</label><input id="m-data" type="date" class="form-control" value="${row?.data_registro || toLocalDateISO()}"></div>
        <div class="form-group"><label>Hora *</label><input id="m-hora" type="time" step="1" class="form-control" value="${formatTimeShort(row?.hora_registro) || '08:00'}"></div>
      </div>
      <div class="form-group"><label>Tipo *</label><select id="m-tipo" class="form-control">${tipoOpts}</select></div>
      <div class="form-group"><label>Terminal</label><input id="m-terminal" class="form-control" value="${row?.nome_terminal_local || 'Terminal-Master'}"></div>
      <div class="form-group"><label>IP</label><input id="m-ip" class="form-control" value="${row?.ip_equipamento || ''}"></div>`,
    footerButtons: [
      { label: 'Cancelar', className: 'btn btn-outline', onClick: closeModal },
      {
        label: 'Salvar',
        className: 'btn btn-primary',
        onClick: async () => {
          try {
            const hora = $('#m-hora').value;
            const payload = {
              user_id: $('#m-user-id').value,
              empresa_id: $('#m-empresa-id').value,
              data_registro: $('#m-data').value,
              hora_registro: hora.length === 5 ? hora + ':00' : hora,
              tipo_registro: $('#m-tipo').value,
              nome_terminal_local: $('#m-terminal').value.trim(),
              ip_equipamento: $('#m-ip').value.trim() || null,
              user_agent: 'Master CRUD'
            };
            if (row) await mc.masterUpdate('registros_ponto', row.id, payload);
            else await mc.masterInsert('registros_ponto', payload);
            closeModal();
            showToast('Registro salvo.', 'success');
            loadRegistros();
          } catch (e) {
            showToast(e.message, 'error');
          }
        }
      }
    ]
  });
}

async function editRegistro(id) {
  showFormRegistro(await mc.masterGet('registros_ponto', id));
}

async function delRegistro(id) {
  if (!confirm('Excluir registro de ponto?')) return;
  try {
    await mc.masterDelete('registros_ponto', id);
    showToast('Excluído.', 'success');
    loadRegistros();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── BACKUP ─────────────────────────────────────────────────
async function exportGlobal(tableName) {
  try {
    const rows = await exportTable(tableName);
    if (!rows.length) {
      showToast('Nenhum registro.', 'info');
      return;
    }
    const cols = Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
    downloadCSV(`${tableName}_${Date.now()}.csv`, rowsToCSV(rows, cols));
    showToast('CSV exportado.', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}
