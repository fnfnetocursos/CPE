/**
 * Utilitários de interface: toast, modal, helpers DOM
 */

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

export function showSection(sectionId) {
  $$('.app-section').forEach((s) => s.classList.add('hidden'));
  const section = document.getElementById(sectionId);
  if (section) section.classList.remove('hidden');
}

export function showView(prefix, viewName) {
  const fullKey = viewName.startsWith(prefix + '-') ? viewName : `${prefix}-${viewName}`;
  const panelSuffix = fullKey.replace(`${prefix}-`, '');

  $$(`[id^="view-${prefix}-"]`).forEach((v) => v.classList.add('hidden'));
  const view = document.getElementById(`view-${prefix}-${panelSuffix}`);
  if (view) view.classList.remove('hidden');

  const links = document.querySelectorAll(`#section-${prefix} .sidebar__link[data-view]`);
  links.forEach((link) => {
    link.classList.toggle('active', link.dataset.view === fullKey);
  });
}

/**
 * Abre modal com conteúdo HTML e botões de ação
 */
export function openModal({ title, bodyHtml, footerButtons = [] }) {
  const overlay = $('#modal-overlay');
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;

  const footer = $('#modal-footer');
  footer.innerHTML = '';
  footerButtons.forEach(({ label, className = 'btn btn-primary', onClick, type = 'button' }) => {
    const btn = document.createElement('button');
    btn.type = type;
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    footer.appendChild(btn);
  });

  overlay.classList.remove('hidden');
}

export function closeModal() {
  $('#modal-overlay').classList.add('hidden');
}

export function setAlert(el, message, type = 'error') {
  if (!el) return;
  if (!message) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.classList.remove('hidden');
  el.style.display = 'block';
}

/** Chave localStorage para nome do terminal */
export const TERMINAL_STORAGE_KEY = 'controle_ponto_nome_terminal';

export function getTerminalName() {
  return localStorage.getItem(TERMINAL_STORAGE_KEY) || '';
}

export function setTerminalName(name) {
  localStorage.setItem(TERMINAL_STORAGE_KEY, name.trim());
}

/** Obtém IP público via ipify (gratuito) */
export async function fetchClientIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip || '';
  } catch {
    return '';
  }
}
