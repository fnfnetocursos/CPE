/**
 * Aplicação principal — inicializa telas após login (módulo ES)
 */
import { state, initSession, logout, loadPerfil } from './auth.js';
import { validateConfig } from './supabase-client.js';
import { showSection, setAlert, closeModal, showToast, $ } from './utils/ui.js';
import { initMaster } from './views/master.js';
import { initAdmin } from './views/admin.js';
import { initColaborador, destroyColaborador } from './views/colaborador.js';

/** Sincroniza state a partir da sessão criada pelo login-ui.js */
async function ensureStateSynced() {
  if (window.__CPE_SESSION__) {
    state.user = window.__CPE_SESSION__.user;
    state.perfil = window.__CPE_SESSION__.perfil;
  }
  if (state.user && !state.perfil) {
    await loadPerfil();
  }
}

function clearLoginMessages() {
  if (typeof window.clearLoginMessages === 'function') {
    window.clearLoginMessages();
  }
}

/** Roteia para a área correta conforme perfil e inicializa menus/dados */
async function routeByProfile() {
  await ensureStateSynced();

  const perfil = state.perfil?.perfil;
  destroyColaborador();
  clearLoginMessages();

  switch (perfil) {
    case 'MASTER':
      showSection('section-master');
      initMaster();
      showToast('Bem-vindo, ' + (state.perfil?.nome || 'Master'), 'success');
      break;
    case 'ADMIN':
      showSection('section-admin');
      initAdmin();
      showToast('Bem-vindo, ' + (state.perfil?.nome || 'Admin'), 'success');
      break;
    case 'COLABORADOR':
      showSection('section-colaborador');
      initColaborador();
      showToast('Bem-vindo, ' + (state.perfil?.nome || 'Colaborador'), 'success');
      break;
    default:
      showSection('section-login');
      notifyLogin(
        `Perfil "${perfil || 'indefinido'}" não reconhecido. Contate o administrador.`,
        'error'
      );
  }
}

function notifyLogin(message, type) {
  if (typeof window.showLoginMessage === 'function') {
    window.showLoginMessage(message, type);
  } else {
    setAlert($('#login-alert'), message, type);
  }
}

async function handleLogout() {
  destroyColaborador();
  await logout();
  window.__CPE_SESSION__ = null;
  showSection('section-login');
  $('#form-login')?.reset();
  notifyLogin('Você saiu do sistema.', 'info');
}

async function handleLoggedIn() {
  try {
    await ensureStateSynced();
    await routeByProfile();
  } catch (err) {
    console.error('[LoggedIn]', err);
    showSection('section-login');
    notifyLogin(err.message || 'Erro ao abrir painel.', 'error');
    showToast(err.message || 'Erro ao abrir painel.', 'error');
  }
}

function bindGlobalEvents() {
  $('#modal-close')?.addEventListener('click', closeModal);
  $('#modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  window.addEventListener('app:logout', handleLogout);
  window.addEventListener('cpe:logged-in', handleLoggedIn);
}

async function bootstrap() {
  bindGlobalEvents();

  window.__CPE_routeByProfile = () => handleLoggedIn();
  window.__CPE_handleLogout = handleLogout;
  window.__CPE_APP_READY__ = true;
  window.dispatchEvent(new CustomEvent('cpe:app-ready'));

  try {
    validateConfig();

    if (window.__CPE_SESSION__?.perfil) {
      await handleLoggedIn();
      return;
    }

    const perfil = await initSession();
    if (perfil) {
      await routeByProfile();
    } else {
      showSection('section-login');
    }
  } catch (err) {
    console.error('[Bootstrap]', err);
    showSection('section-login');
    notifyLogin(err.message || 'Erro ao iniciar aplicação.', 'error');
  }
}

bootstrap();
