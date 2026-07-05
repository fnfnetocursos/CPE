/**
 * View Admin — dashboard, CRUDs, relatórios e terminal
 */
import { state, getEmpresaId } from '../auth.js';
import * as colabSvc from '../services/colaboradores.js';
import * as jornadaSvc from '../services/jornadas.js';
import * as feriadoSvc from '../services/feriados-afastamentos.js';
import * as regSvc from '../services/registros.js';
import { calcularBancoHoras } from '../engine/banco-horas.js';
import {
  openModal,
  closeModal,
  showToast,
  showView,
  setTerminalName,
  getTerminalName,
  $
} from '../utils/ui.js';
import { rowsToCSV, downloadCSV } from '../utils/csv.js';
import {
  formatDateBR,
  formatTimeShort,
  currentMonthRange,
  currentWeekRange,
  toLocalDateISO
} from '../utils/time.js';

const TITLES = {
  'admin-dashboard': 'Dashboard',
  'admin-colaboradores': 'Colaboradores',
  'admin-jornadas': 'Jornadas',
  'admin-feriados': 'Feriados',
  'admin-afastamentos': 'Afastamentos',
  'admin-relatorios': 'Relatórios',
  'admin-terminal': 'Terminal',
  'admin-backup': 'Backup CSV'
};

let bound = false;
let jornadasCache = [];
let colaboradoresCache = [];
let lastRelatorio = null;

export function initAdmin() {
  const empresaNome = state.empresa?.razao_social || 'Empresa';
  $('#admin-empresa-nome').textContent = empresaNome;
  $('#admin-user-info').textContent = `${state.perfil?.nome} · ADMIN`;

  if (!bound) {
    bound = true;
    document.querySelectorAll('#section-admin .sidebar__link[data-view]').forEach((link) => {
      link.addEventListener('click', async () => {
        const view = link.dataset.view;
        showView('admin', view);
        $('#admin-page-title').textContent = TITLES[view] || view;
        await onAdminView(view);
      });
    });

    $('#btn-logout-admin')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('app:logout')));
    $('#btn-novo-colaborador')?.addEventListener('click', () => showFormColaborador());
    $('#btn-nova-jornada')?.addEventListener('click', () => showFormJornada());
    $('#btn-novo-feriado')?.addEventListener('click', () => showFormFeriado());
    $('#btn-novo-afastamento')?.addEventListener('click', () => showFormAfastamento());
    $('#btn-gerar-relatorio')?.addEventListener('click', gerarRelatorio);
    $('#btn-exportar-espelho')?.addEventListener('click', exportarEspelho);
    $('#btn-salvar-terminal')?.addEventListener('click', salvarTerminal);

    document.querySelectorAll('[data-export-empresa]').forEach((btn) => {
      btn.addEventListener('click', () => exportEmpresa(btn.dataset.exportEmpresa));
    });

    initRelatorioDates();

    window.addEventListener('cpe:view-changed', async (e) => {
      const view = e.detail?.view;
      if (view?.startsWith('admin-')) await onAdminView(view);
    });
  }

  loadDashboard();
  updateTerminalInfo();
}

async function onAdminView(view) {
  switch (view) {
    case 'admin-dashboard':
      await loadDashboard();
      break;
    case 'admin-colaboradores':
      await loadColaboradores();
      break;
    case 'admin-jornadas':
      await loadJornadas();
      break;
    case 'admin-feriados':
      await loadFeriados();
      break;
    case 'admin-afastamentos':
      await loadAfastamentos();
      break;
    case 'admin-relatorios':
      await populateColaboradorSelect();
      break;
    case 'admin-terminal':
      updateTerminalInfo();
      break;
    default:
      break;
  }
}

function initRelatorioDates() {
  const { start, end } = currentMonthRange();
  $('#relatorio-inicio').value = start;
  $('#relatorio-fim').value = end;
}

async function loadDashboard() {
  const empresaId = getEmpresaId();
  const kpis = $('#admin-kpis');
  try {
    const presentes = await regSvc.countPresentesHoje(empresaId);
    const colabs = await colabSvc.listColaboradores(empresaId);
    const ativos = colabs.filter((c) => c.ativo).length;

    const week = currentWeekRange();
    const month = currentMonthRange();
    const regsSemana = await regSvc.listRegistros({ empresaId, dataInicio: week.start, dataFim: week.end });
    const regsMes = await regSvc.listRegistros({ empresaId, dataInicio: month.start, dataFim: month.end });

    const feriados = await feriadoSvc.listFeriados(empresaId);
    const afastamentos = await feriadoSvc.listAfastamentos(empresaId);
    const jornadas = await jornadaSvc.listJornadas(empresaId);
    const jornadaPadrao = jornadas[0];

    let faltasSemana = 0;
    let horasExtraMes = 0;

    for (const c of colabs.filter((x) => x.ativo)) {
      const userRegs = regsSemana.filter((r) => r.user_id === c.user_id);
      const res = calcularBancoHoras({
        registros: userRegs,
        jornada: c.jornada_id ? jornadas.find((j) => j.id === c.jornada_id) : jornadaPadrao,
        feriados,
        afastamentos,
        userId: c.user_id,
        empresaId,
        dataInicio: week.start,
        dataFim: week.end
      });
      faltasSemana += res.espelho.filter((d) => d.contaCarga && d.saldoDia < 0 && d.minutosTrabalhados === 0).length;

      const userRegsMes = regsMes.filter((r) => r.user_id === c.user_id);
      const resMes = calcularBancoHoras({
        registros: userRegsMes,
        jornada: c.jornada_id ? jornadas.find((j) => j.id === c.jornada_id) : jornadaPadrao,
        feriados,
        afastamentos,
        userId: c.user_id,
        empresaId,
        dataInicio: month.start,
        dataFim: month.end
      });
      horasExtraMes += resMes.diasHoraExtra;
    }

    kpis.innerHTML = `
      <div class="kpi-card kpi-card--success">
        <div class="kpi-card__label">Presentes Hoje</div>
        <div class="kpi-card__value">${presentes} / ${ativos}</div>
      </div>
      <div class="kpi-card kpi-card--danger">
        <div class="kpi-card__label">Faltas na Semana</div>
        <div class="kpi-card__value">${faltasSemana}</div>
      </div>
      <div class="kpi-card kpi-card--warning">
        <div class="kpi-card__label">Dias c/ Hora Extra (Mês)</div>
        <div class="kpi-card__value">${horasExtraMes}</div>
      </div>
    `;
  } catch (e) {
    kpis.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

async function loadColaboradores() {
  const tbody = $('#table-colaboradores tbody');
  try {
    colaboradoresCache = await colabSvc.listColaboradores(getEmpresaId());
    if (!colaboradoresCache.length) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhum colaborador.</td></tr>';
      return;
    }
    tbody.innerHTML = colaboradoresCache
      .map((c) => {
        const nome = c.perfis?.nome || '—';
        const jornada = c.jornadas_trabalho?.descricao || '—';
        const status = c.ativo
          ? '<span class="badge badge-success">Ativo</span>'
          : '<span class="badge badge-danger">Inativo</span>';
        return `
        <tr>
          <td>${nome}</td>
          <td>${c.matricula || '—'}</td>
          <td>${jornada}</td>
          <td>${formatDateBR(c.data_admissao)}</td>
          <td>${status}</td>
          <td>
            <button class="btn btn-sm btn-outline btn-edit-colab" data-id="${c.id}">Editar</button>
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.btn-edit-colab').forEach((b) =>
      b.addEventListener('click', () => editColaborador(b.dataset.id))
    );
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6">${e.message}</td></tr>`;
  }
}

async function loadJornadas() {
  const tbody = $('#table-jornadas tbody');
  try {
    jornadasCache = await jornadaSvc.listJornadas(getEmpresaId());
    if (!jornadasCache.length) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhuma jornada.</td></tr>';
      return;
    }
    tbody.innerHTML = jornadasCache
      .map(
        (j) => `
      <tr>
        <td>${j.descricao}</td>
        <td>${formatTimeShort(j.entrada_prevista)}</td>
        <td>${formatTimeShort(j.saida_prevista)}</td>
        <td>${j.carga_diaria_minutos}</td>
        <td>${j.tolerancia_minutos} min</td>
        <td>
          <button class="btn btn-sm btn-outline btn-edit-jornada" data-id="${j.id}">Editar</button>
          <button class="btn btn-sm btn-danger btn-del-jornada" data-id="${j.id}">Excluir</button>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('.btn-edit-jornada').forEach((b) =>
      b.addEventListener('click', () => editJornada(b.dataset.id))
    );
    tbody.querySelectorAll('.btn-del-jornada').forEach((b) =>
      b.addEventListener('click', () => deleteJornada(b.dataset.id))
    );
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6">${e.message}</td></tr>`;
  }
}

async function loadFeriados() {
  const tbody = $('#table-feriados tbody');
  try {
    const rows = await feriadoSvc.listFeriados(getEmpresaId());
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">Nenhum feriado.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (f) => `
      <tr>
        <td>${formatDateBR(f.data_feriado)}</td>
        <td>${f.descricao}</td>
        <td>${f.empresa_id ? 'Empresa' : 'Nacional'}</td>
        <td><button class="btn btn-sm btn-danger btn-del-feriado" data-id="${f.id}">Excluir</button></td>
      </tr>`
      )
      .join('');
    tbody.querySelectorAll('.btn-del-feriado').forEach((b) =>
      b.addEventListener('click', async () => {
        if (confirm('Excluir feriado?')) {
          await feriadoSvc.deleteFeriado(b.dataset.id);
          loadFeriados();
        }
      })
    );
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4">${e.message}</td></tr>`;
  }
}

async function loadAfastamentos() {
  const tbody = $('#table-afastamentos tbody');
  try {
    const rows = await feriadoSvc.listAfastamentos(getEmpresaId());
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhum afastamento.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (a) => `
      <tr>
        <td>${a.perfis?.nome || '—'}</td>
        <td>${formatDateBR(a.data_inicio)}</td>
        <td>${formatDateBR(a.data_fim)}</td>
        <td>${a.motivo}</td>
        <td>${a.abonado ? 'Sim' : 'Não'}</td>
        <td>
          <button class="btn btn-sm btn-outline btn-edit-afast" data-id="${a.id}">Editar</button>
          <button class="btn btn-sm btn-danger btn-del-afast" data-id="${a.id}">Excluir</button>
        </td>
      </tr>`
      )
      .join('');
    tbody.querySelectorAll('.btn-edit-afast').forEach((b) =>
      b.addEventListener('click', () => editAfastamento(b.dataset.id, rows))
    );
    tbody.querySelectorAll('.btn-del-afast').forEach((b) =>
      b.addEventListener('click', async () => {
        if (confirm('Excluir?')) {
          await feriadoSvc.deleteAfastamento(b.dataset.id);
          loadAfastamentos();
        }
      })
    );
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6">${e.message}</td></tr>`;
  }
}

async function populateColaboradorSelect() {
  const select = $('#relatorio-colaborador');
  colaboradoresCache = await colabSvc.listColaboradores(getEmpresaId());
  select.innerHTML =
    '<option value="">Selecione...</option>' +
    colaboradoresCache
      .filter((c) => c.ativo)
      .map((c) => `<option value="${c.user_id}">${c.perfis?.nome || c.user_id}</option>`)
      .join('');
}

async function showFormColaborador(colab = null) {
  jornadasCache = await jornadaSvc.listJornadas(getEmpresaId());
  const jornadaOpts = jornadasCache
    .map((j) => `<option value="${j.id}" ${colab?.jornada_id === j.id ? 'selected' : ''}>${j.descricao}</option>`)
    .join('');

  openModal({
    title: colab ? 'Editar Colaborador' : 'Novo Colaborador',
    bodyHtml: colab
      ? `
      <div class="form-group"><label>Matrícula</label><input id="c-matricula" class="form-control" value="${colab.matricula || ''}"></div>
      <div class="form-group"><label>Jornada</label><select id="c-jornada" class="form-control"><option value="">—</option>${jornadaOpts}</select></div>
      <div class="form-group form-check"><input type="checkbox" id="c-ativo" ${colab.ativo ? 'checked' : ''}> <label for="c-ativo">Ativo</label></div>`
      : `
      <div class="form-group"><label>Nome</label><input id="c-nome" class="form-control" required></div>
      <div class="form-group"><label>E-mail</label><input type="email" id="c-email" class="form-control" required></div>
      <div class="form-group"><label>Senha inicial</label><input type="password" id="c-senha" class="form-control" required></div>
      <div class="form-group"><label>Matrícula</label><input id="c-matricula" class="form-control"></div>
      <div class="form-group"><label>Jornada</label><select id="c-jornada" class="form-control"><option value="">—</option>${jornadaOpts}</select></div>
      <div class="form-group"><label>Data Admissão</label><input type="date" id="c-admissao" class="form-control" value="${toLocalDateISO()}" required></div>`,
    footerButtons: [
      { label: 'Cancelar', className: 'btn btn-outline', onClick: closeModal },
      {
        label: 'Salvar',
        className: 'btn btn-primary',
        onClick: async () => {
          try {
            if (colab) {
              await colabSvc.updateColaborador(colab.id, {
                matricula: $('#c-matricula').value.trim(),
                jornada_id: $('#c-jornada').value || null,
                ativo: $('#c-ativo').checked
              });
            } else {
              await colabSvc.createColaborador({
                nome: $('#c-nome').value.trim(),
                email: $('#c-email').value.trim(),
                senha: $('#c-senha').value,
                empresa_id: getEmpresaId(),
                matricula: $('#c-matricula').value.trim(),
                jornada_id: $('#c-jornada').value || null,
                data_admissao: $('#c-admissao').value
              });
            }
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

function editColaborador(id) {
  const colab = colaboradoresCache.find((c) => c.id === id);
  if (colab) showFormColaborador(colab);
}

function showFormJornada(jornada = null) {
  openModal({
    title: jornada ? 'Editar Jornada' : 'Nova Jornada',
    bodyHtml: `
      <div class="form-group"><label>Descrição</label><input id="j-desc" class="form-control" value="${jornada?.descricao || ''}"></div>
      <div class="form-row">
        <div class="form-group"><label>Entrada Prevista</label><input type="time" id="j-entrada" class="form-control" value="${formatTimeShort(jornada?.entrada_prevista) || '08:00'}"></div>
        <div class="form-group"><label>Saída Prevista</label><input type="time" id="j-saida" class="form-control" value="${formatTimeShort(jornada?.saida_prevista) || '18:00'}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Carga Diária (minutos)</label><input type="number" id="j-carga" class="form-control" value="${jornada?.carga_diaria_minutos ?? 480}"></div>
        <div class="form-group"><label>Tolerância (min)</label><input type="number" id="j-tolerancia" class="form-control" value="${jornada?.tolerancia_minutos ?? 10}"></div>
      </div>`,
    footerButtons: [
      { label: 'Cancelar', className: 'btn btn-outline', onClick: closeModal },
      {
        label: 'Salvar',
        className: 'btn btn-primary',
        onClick: async () => {
          const payload = {
            empresa_id: getEmpresaId(),
            descricao: $('#j-desc').value.trim(),
            entrada_prevista: $('#j-entrada').value + ':00',
            saida_prevista: $('#j-saida').value + ':00',
            carga_diaria_minutos: parseInt($('#j-carga').value, 10),
            tolerancia_minutos: parseInt($('#j-tolerancia').value, 10)
          };
          try {
            if (jornada) await jornadaSvc.updateJornada(jornada.id, payload);
            else await jornadaSvc.createJornada(payload);
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
  const j = await jornadaSvc.getJornada(id);
  showFormJornada(j);
}

async function deleteJornada(id) {
  if (!confirm('Excluir jornada?')) return;
  try {
    await jornadaSvc.deleteJornada(id);
    loadJornadas();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function showFormFeriado() {
  openModal({
    title: 'Novo Feriado',
    bodyHtml: `
      <div class="form-group"><label>Data</label><input type="date" id="f-data" class="form-control"></div>
      <div class="form-group"><label>Descrição</label><input id="f-desc" class="form-control"></div>
      <div class="form-group form-check"><input type="checkbox" id="f-nacional"> <label for="f-nacional">Feriado nacional (todas empresas)</label></div>`,
    footerButtons: [
      { label: 'Cancelar', className: 'btn btn-outline', onClick: closeModal },
      {
        label: 'Salvar',
        className: 'btn btn-primary',
        onClick: async () => {
          try {
            await feriadoSvc.createFeriado({
              data_feriado: $('#f-data').value,
              descricao: $('#f-desc').value.trim(),
              empresa_id: $('#f-nacional').checked ? null : getEmpresaId()
            });
            closeModal();
            loadFeriados();
          } catch (e) {
            showToast(e.message, 'error');
          }
        }
      }
    ]
  });
}

function showFormAfastamento(afast = null) {
  const colabOpts = colaboradoresCache
    .map((c) => `<option value="${c.user_id}" ${afast?.user_id === c.user_id ? 'selected' : ''}>${c.perfis?.nome}</option>`)
    .join('');

  openModal({
    title: afast ? 'Editar Afastamento' : 'Novo Afastamento',
    bodyHtml: `
      <div class="form-group"><label>Colaborador</label><select id="a-user" class="form-control" ${afast ? 'disabled' : ''}>${colabOpts}</select></div>
      <div class="form-row">
        <div class="form-group"><label>Início</label><input type="date" id="a-inicio" class="form-control" value="${afast?.data_inicio || ''}"></div>
        <div class="form-group"><label>Fim</label><input type="date" id="a-fim" class="form-control" value="${afast?.data_fim || ''}"></div>
      </div>
      <div class="form-group"><label>Motivo</label><input id="a-motivo" class="form-control" value="${afast?.motivo || ''}"></div>
      <div class="form-group form-check"><input type="checkbox" id="a-abonado" ${afast?.abonado !== false ? 'checked' : ''}> <label for="a-abonado">Abonar dias</label></div>`,
    footerButtons: [
      { label: 'Cancelar', className: 'btn btn-outline', onClick: closeModal },
      {
        label: 'Salvar',
        className: 'btn btn-primary',
        onClick: async () => {
          const payload = {
            user_id: afast?.user_id || $('#a-user').value,
            empresa_id: getEmpresaId(),
            data_inicio: $('#a-inicio').value,
            data_fim: $('#a-fim').value,
            motivo: $('#a-motivo').value.trim(),
            abonado: $('#a-abonado').checked
          };
          try {
            if (afast) await feriadoSvc.updateAfastamento(afast.id, payload);
            else await feriadoSvc.createAfastamento(payload);
            closeModal();
            loadAfastamentos();
          } catch (e) {
            showToast(e.message, 'error');
          }
        }
      }
    ]
  });
}

function editAfastamento(id, rows) {
  const a = rows.find((x) => x.id === id);
  if (a) showFormAfastamento(a);
}

async function gerarRelatorio() {
  const userId = $('#relatorio-colaborador').value;
  const dataInicio = $('#relatorio-inicio').value;
  const dataFim = $('#relatorio-fim').value;
  if (!userId || !dataInicio || !dataFim) {
    showToast('Preencha colaborador e período.', 'error');
    return;
  }

  try {
    const empresaId = getEmpresaId();
    const [registros, feriados, afastamentos, jornadas] = await Promise.all([
      regSvc.listRegistros({ userId, empresaId, dataInicio, dataFim }),
      feriadoSvc.listFeriados(empresaId),
      feriadoSvc.listAfastamentos(empresaId),
      jornadaSvc.listJornadas(empresaId)
    ]);

    const colab = colaboradoresCache.find((c) => c.user_id === userId);
    const jornada = colab?.jornada_id
      ? jornadas.find((j) => j.id === colab.jornada_id)
      : jornadas[0];

    lastRelatorio = calcularBancoHoras({
      registros,
      jornada,
      feriados,
      afastamentos: afastamentos.filter((a) => a.user_id === userId),
      userId,
      empresaId,
      dataInicio,
      dataFim
    });

    $('#relatorio-kpis').innerHTML = `
      <div class="kpi-card"><div class="kpi-card__label">Horas Trabalhadas</div><div class="kpi-card__value">${lastRelatorio.totalHorasTrabalhadas}</div></div>
      <div class="kpi-card kpi-card--danger"><div class="kpi-card__label">Horas Faltantes</div><div class="kpi-card__value">${lastRelatorio.totalHorasFaltantes}</div></div>
      <div class="kpi-card kpi-card--warning"><div class="kpi-card__label">Dias em Atraso</div><div class="kpi-card__value">${lastRelatorio.diasAtraso}</div></div>
      <div class="kpi-card kpi-card--success"><div class="kpi-card__label">Dias c/ Hora Extra</div><div class="kpi-card__value">${lastRelatorio.diasHoraExtra}</div></div>
      <div class="kpi-card"><div class="kpi-card__label">Banco de Horas</div><div class="kpi-card__value">${lastRelatorio.saldoBancoHoras}</div></div>
    `;

    const tbody = $('#table-espelho tbody');
    tbody.innerHTML = lastRelatorio.espelho
      .map((d) => {
        const cls = d.saldoDia > 0 ? 'text-success' : d.saldoDia < 0 ? 'text-danger' : '';
        return `
        <tr>
          <td>${formatDateBR(d.data)}</td>
          <td>${d.marcacoes}</td>
          <td>${d.cargaPrevista}</td>
          <td>${d.horasTrabalhadas}</td>
          <td class="${cls}">${d.saldoFormatado}</td>
        </tr>`;
      })
      .join('');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function exportarEspelho() {
  if (!lastRelatorio) {
    showToast('Gere o relatório primeiro.', 'info');
    return;
  }
  const cols = [
    { key: 'data', label: 'Data' },
    { key: 'marcacoes', label: 'Marcações' },
    { key: 'cargaPrevista', label: 'Carga Prevista' },
    { key: 'horasTrabalhadas', label: 'Horas Trabalhadas' },
    { key: 'saldoFormatado', label: 'Saldo' }
  ];
  downloadCSV(`espelho_ponto_${Date.now()}.csv`, rowsToCSV(lastRelatorio.espelho, cols));
}

function salvarTerminal() {
  const nome = $('#input-nome-terminal').value.trim();
  if (!nome) {
    showToast('Informe um nome.', 'error');
    return;
  }
  setTerminalName(nome);
  showToast('Terminal salvo neste navegador.', 'success');
  updateTerminalInfo();
}

function updateTerminalInfo() {
  const nome = getTerminalName();
  $('#input-nome-terminal').value = nome;
  $('#terminal-atual-info').textContent = nome
    ? `Terminal atual: ${nome}`
    : 'Nenhum terminal configurado neste navegador.';
}

async function exportEmpresa(tableName) {
  try {
    const rows = await regSvc.exportTable(tableName, { empresa_id: getEmpresaId() });
    if (!rows.length) {
      showToast('Nenhum registro.', 'info');
      return;
    }
    const cols = Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
    downloadCSV(`${tableName}_empresa_${Date.now()}.csv`, rowsToCSV(rows, cols));
    showToast('Exportado.', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}
