/**
 * View Colaborador — registro de ponto e histórico
 */
import { state } from '../auth.js';
import { listRegistrosHoje, createRegistroPonto, listRegistros } from '../services/registros.js';
import { proximoTipoBatida, TIPO_LABELS } from '../engine/banco-horas.js';
import {
  showToast,
  showView,
  setAlert,
  fetchClientIP,
  getTerminalName,
  $
} from '../utils/ui.js';
import { toLocalDateISO, formatDateBR, currentMonthRange } from '../utils/time.js';

const PUNCH_TYPES = [
  { tipo: 'ENTRADA', label: 'Entrada', className: 'btn-success' },
  { tipo: 'SAIDA_ALMOCO', label: 'Saída Almoço', className: 'btn-warning' },
  { tipo: 'RETORNO_ALMOCO', label: 'Retorno Almoço', className: 'btn-warning' },
  { tipo: 'SAIDA', label: 'Saída Término', className: 'btn-danger' },
  { tipo: 'HORAS_EXTRA', label: 'Horas Extras', className: 'btn-secondary' }
];

let clockInterval = null;
let serverOffsetMs = 0;
let registrosHoje = [];

let bound = false;
let colaboradorClockStarted = false;

export function initColaborador() {
  $('#colab-user-info').textContent = `${state.perfil?.nome} · Colaborador`;

  if (!bound) {
    bound = true;
    document.querySelectorAll('#section-colaborador .sidebar__link[data-view]').forEach((link) => {
      link.addEventListener('click', () => {
        const view = link.dataset.view.replace('colab-', '');
        showView('colab', view);
        $('#colab-page-title').textContent = view === 'ponto' ? 'Registrar Ponto' : 'Meu Histórico';
        if (view === 'historico') initHistoricoDates();
      });
    });

    $('#btn-logout-colab')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('app:logout')));
    $('#btn-colab-historico')?.addEventListener('click', loadHistorico);

    window.addEventListener('cpe:view-changed', (e) => {
      const view = e.detail?.view;
      if (view === 'colab-historico') initHistoricoDates();
      if (view === 'colab-ponto') loadBatidasHoje();
    });
  }

  renderPunchButtons();
  if (!colaboradorClockStarted) {
    colaboradorClockStarted = true;
    startClock();
    syncServerTime();
  }
  loadBatidasHoje();

  if (!getTerminalName()) {
    showToast('Terminal não identificado. Solicite ao admin a configuração do nome.', 'info');
  }
}

function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  updateClockDisplay();
  clockInterval = setInterval(updateClockDisplay, 1000);
}

function updateClockDisplay() {
  const now = new Date(Date.now() + serverOffsetMs);
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  $('#clock-display').textContent = `${h}:${m}:${s}`;

  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  $('#clock-date').textContent = `${dias[now.getDay()]}, ${now.getDate()} ${meses[now.getMonth()]} ${now.getFullYear()}`;
}

/** Sincroniza offset com horário do servidor Supabase */
async function syncServerTime() {
  const statusEl = $('#clock-sync-status');
  try {
    const localBefore = Date.now();
    const res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: window.APP_CONFIG.SUPABASE_ANON_KEY }
    });
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      const localAfter = Date.now();
      const rtt = (localAfter - localBefore) / 2;
      serverOffsetMs = serverTime - localAfter + rtt;

      const diffSec = Math.abs(Math.round(serverOffsetMs / 1000));
      if (diffSec > 120) {
        statusEl.textContent = `⚠ Divergência de ${diffSec}s detectada — horário ajustado pelo servidor`;
        statusEl.style.color = '#fbbf24';
      } else {
        statusEl.textContent = `✓ Horário sincronizado com servidor (offset ${serverOffsetMs >= 0 ? '+' : ''}${Math.round(serverOffsetMs / 1000)}s)`;
      }
    } else {
      statusEl.textContent = 'Horário local (sincronização indisponível)';
    }
  } catch {
    statusEl.textContent = 'Horário local — não foi possível sincronizar com servidor';
  }
}

function renderPunchButtons() {
  const container = $('#punch-buttons');
  const proximo = proximoTipoBatida(registrosHoje);

  container.innerHTML = PUNCH_TYPES.map(({ tipo, label, className }) => {
    const recommended = tipo === proximo ? ' recommended' : '';
    return `<button type="button" class="btn punch-btn ${className}${recommended}" data-tipo="${tipo}">${label}</button>`;
  }).join('');

  container.querySelectorAll('[data-tipo]').forEach((btn) => {
    btn.addEventListener('click', () => registrarBatida(btn.dataset.tipo));
  });
}

async function loadBatidasHoje() {
  try {
    registrosHoje = await listRegistrosHoje(state.user.id, state.perfil.empresa_id);
    const tbody = $('#table-batidas-hoje tbody');
    if (!registrosHoje.length) {
      tbody.innerHTML = '<tr><td colspan="4">Nenhuma batida hoje.</td></tr>';
    } else {
      tbody.innerHTML = registrosHoje
        .map(
          (r) => `
        <tr>
          <td>${r.hora_registro.substring(0, 8)}</td>
          <td>${TIPO_LABELS[r.tipo_registro] || r.tipo_registro}</td>
          <td>${r.nome_terminal_local || '—'}</td>
          <td>${r.ip_equipamento || '—'}</td>
        </tr>`
        )
        .join('');
    }
    renderPunchButtons();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function registrarBatida(tipo) {
  const alertEl = $('#punch-alert');
  setAlert(alertEl, null);

  const terminal = getTerminalName();
  if (!terminal) {
    setAlert(alertEl, 'Terminal não configurado. Peça ao administrador para nomear este navegador.', 'error');
    return;
  }

  const now = new Date(Date.now() + serverOffsetMs);
  const hora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  try {
    const ip = await fetchClientIP();
    await createRegistroPonto({
      user_id: state.user.id,
      empresa_id: state.perfil.empresa_id,
      tipo_registro: tipo,
      ip_equipamento: ip,
      user_agent: navigator.userAgent,
      nome_terminal_local: terminal,
      hora_registro: hora,
      data_registro: toLocalDateISO(now)
    });

    setAlert(alertEl, `${TIPO_LABELS[tipo]} registrada às ${hora.substring(0, 5)}!`, 'success');
    showToast('Ponto registrado com sucesso!', 'success');
    await loadBatidasHoje();
  } catch (e) {
    setAlert(alertEl, e.message, 'error');
  }
}

function initHistoricoDates() {
  const { start, end } = currentMonthRange();
  $('#colab-hist-inicio').value = start;
  $('#colab-hist-fim').value = end;
}

async function loadHistorico() {
  const inicio = $('#colab-hist-inicio').value;
  const fim = $('#colab-hist-fim').value;
  if (!inicio || !fim) {
    showToast('Informe o período.', 'error');
    return;
  }

  try {
    const rows = await listRegistros({
      userId: state.user.id,
      empresaId: state.perfil.empresa_id,
      dataInicio: inicio,
      dataFim: fim
    });
    const tbody = $('#table-colab-historico tbody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="3">Nenhum registro no período.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td>${formatDateBR(r.data_registro)}</td>
        <td>${r.hora_registro.substring(0, 5)}</td>
        <td>${TIPO_LABELS[r.tipo_registro] || r.tipo_registro}</td>
      </tr>`
      )
      .join('');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

export function destroyColaborador() {
  if (clockInterval) clearInterval(clockInterval);
}
