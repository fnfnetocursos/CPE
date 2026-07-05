/**
 * View Master — gestão global (acesso total)
 */
import { state } from '../auth.js';
import * as empresasSvc from '../services/empresas.js';
import { createAdminEmpresa, listAllPerfis, listAllColaboradores } from '../services/colaboradores.js';
import { exportTable } from '../services/registros.js';
import { openModal, closeModal, showToast, showView, $ } from '../utils/ui.js';
import { rowsToCSV, downloadCSV } from '../utils/csv.js';
import { formatDateBR } from '../utils/time.js';

const TITLES = {
  'master-empresas': 'Empresas',
  'master-perfis': 'Usuários (Perfis)',
  'master-colaboradores': 'Colaboradores (Global)',
  'master-registros': 'Registros de Ponto (Global)',
  'master-backup': 'Backup CSV'
};

let bound = false;

export function initMaster() {
  $('#master-user-info').textContent = `${state.perfil?.nome || ''} · MASTER`;

  if (!bound) {
    bound = true;

    document.querySelectorAll('#section-master .sidebar__link[data-view]').forEach((link) => {
      link.addEventListener('click', () => {
        const view = link.dataset.view;
        showView('master', view);
        $('#master-page-title').textContent = TITLES[view] || view;
        onMasterView(view);
      });
    });

    $('#btn-nova-empresa')?.addEventListener('click', showFormEmpresa);
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
  switch (view) {
    case 'master-empresas':
      loadEmpresas();
      break;
    case 'master-perfis':
      loadPerfis();
      break;
    case 'master-colaboradores':
      loadColaboradoresGlobal();
      break;
    case 'master-registros':
      loadRegistrosGlobal();
      break;
    default:
      break;
  }
}

async function loadEmpresas() {
  const tbody = $('#table-empresas tbody');
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
  try {
    const rows = await empresasSvc.listEmpresas();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhuma empresa cadastrada.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (e) => `
      <tr>
        <td>${e.razao_social}</td>
        <td>${e.cnpj}</td>
        <td>${e.email_admin || '—'}</td>
        <td>${formatDateBR(e.created_at?.slice(0, 10))}</td>
        <td>
          <button class="btn btn-sm btn-outline btn-edit-empresa" data-id="${e.id}">Editar</button>
          <button class="btn btn-sm btn-danger btn-del-empresa" data-id="${e.id}">Excluir</button>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('.btn-edit-empresa').forEach((b) =>
      b.addEventListener('click', () => editEmpresa(b.dataset.id))
    );
    tbody.querySelectorAll('.btn-del-empresa').forEach((b) =>
      b.addEventListener('click', () => deleteEmpresaConfirm(b.dataset.id))
    );
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Erro: ${err.message}</td></tr>`;
  }
}

async function loadPerfis() {
  const tbody = $('#table-master-perfis tbody');
  tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
  try {
    const rows = await listAllPerfis();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">Nenhum usuário.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (p) => `
      <tr>
        <td>${p.nome}</td>
        <td>${p.perfil}</td>
        <td>${p.empresa_id || '— (global)'}</td>
        <td>${formatDateBR(String(p.created_at || '').slice(0, 10))}</td>
      </tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">Erro: ${err.message}</td></tr>`;
  }
}

async function loadColaboradoresGlobal() {
  const tbody = $('#table-master-colaboradores tbody');
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
  try {
    const rows = await listAllColaboradores();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhum colaborador.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (c) => `
      <tr>
        <td>${c.matricula || '—'}</td>
        <td style="font-size:0.75rem">${c.user_id}</td>
        <td style="font-size:0.75rem">${c.empresa_id}</td>
        <td>${formatDateBR(c.data_admissao)}</td>
        <td>${c.ativo ? 'Sim' : 'Não'}</td>
      </tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Erro: ${err.message}</td></tr>`;
  }
}

async function loadRegistrosGlobal() {
  const tbody = $('#table-master-registros tbody');
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
  try {
    const rows = await exportTable('registros_ponto');
    const recent = (rows || []).slice(-100).reverse();
    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhum registro.</td></tr>';
      return;
    }
    tbody.innerHTML = recent
      .map(
        (r) => `
      <tr>
        <td>${formatDateBR(r.data_registro)}</td>
        <td>${String(r.hora_registro).slice(0, 8)}</td>
        <td>${r.tipo_registro}</td>
        <td style="font-size:0.75rem">${r.user_id}</td>
        <td>${r.nome_terminal_local || '—'}</td>
      </tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Erro: ${err.message}</td></tr>`;
  }
}

function showFormEmpresa(empresa = null) {
  const isEdit = !!empresa;
  openModal({
    title: isEdit ? 'Editar Empresa' : 'Nova Empresa',
    bodyHtml: `
      <div class="form-group"><label>Razão Social</label><input type="text" id="m-razao" class="form-control" value="${empresa?.razao_social || ''}"></div>
      <div class="form-group"><label>CNPJ</label><input type="text" id="m-cnpj" class="form-control" value="${empresa?.cnpj || ''}"></div>
      <div class="form-group"><label>E-mail do Admin</label><input type="email" id="m-email-admin" class="form-control" value="${empresa?.email_admin || ''}"></div>
      ${!isEdit ? `
      <hr style="margin:1rem 0;border:none;border-top:1px solid var(--color-border)">
      <div class="form-group"><label>Nome do Admin</label><input type="text" id="m-admin-nome" class="form-control"></div>
      <div class="form-group"><label>Senha do Admin</label><input type="password" id="m-admin-senha" class="form-control"></div>` : ''}`,
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
            if (isEdit) {
              await empresasSvc.updateEmpresa(empresa.id, payload);
            } else {
              const nova = await empresasSvc.createEmpresa(payload);
              const adminNome = $('#m-admin-nome')?.value.trim();
              const adminSenha = $('#m-admin-senha')?.value;
              if (adminNome && adminSenha && payload.email_admin) {
                await createAdminEmpresa({
                  email: payload.email_admin,
                  senha: adminSenha,
                  nome: adminNome,
                  empresa_id: nova.id
                });
              }
            }
            closeModal();
            showToast('Salvo com sucesso.', 'success');
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
  const empresa = await empresasSvc.getEmpresa(id);
  showFormEmpresa(empresa);
}

async function deleteEmpresaConfirm(id) {
  if (!confirm('Excluir esta empresa e todos os dados vinculados?')) return;
  try {
    await empresasSvc.deleteEmpresa(id);
    showToast('Empresa excluída.', 'success');
    loadEmpresas();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

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
