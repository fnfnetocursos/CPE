/**
 * Aplicação principal — inicializa telas após login (módulo ES)
 */
import { state, initSession, logout, loadPerfil } from './auth.js';
import { validateConfig } from './supabase-client.js';
import { showSection, setAlert, closeModal, showToast, clearToasts, $ } from './utils/ui.js';
import { initMaster } from './views/master.js';
import { initAdmin } from './views/admin.js';
import { initColaborador, destroyColaborador } from './views/colaborador.js';

async function ensureStateSynced() {
  if (window.__CPE_SESSION__?.user) {
    state.user = window.__CPE_SESSION__.user;
  }
  if (state.user || window.__CPE_SESSION__?.user) {
    if (!state.user) state.user = window.__CPE_SESSION__.user;
    await loadPerfil();
  }
}

async function routeByProfile() {
  await ensureStateSynced();

  const perfil = state.perfil?.perfil;
  destroyColaborador();

  if (typeof window.clearLoginMessages === 'function') {
    window.clearLoginMessages();
  }

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
      if (typeof window.showLoginMessage === 'function') {
        window.showLoginMessage(
          `Perfil "${perfil || 'indefinido'}" não reconhecido.`,
          'error',
          0
        );
      }
  }
}

async function handleLogout() {
  destroyColaborador();
  await logout();
  window.__CPE_SESSION__ = null;

  if (typeof window.resetSessionUI === 'function') {
    window.resetSessionUI();
  } else {
    clearToasts();
  }

  showSection('section-login');
  $('#form-login')?.reset();
}

async function handleLoggedIn() {
  try {
    await routeByProfile();
  } catch (err) {
    console.error('[LoggedIn]', err);
    showSection('section-login');
    if (typeof window.showLoginMessage === 'function') {
      window.showLoginMessage(err.message || 'Erro ao abrir painel.', 'error', 0);
    }
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

  window.__CPE_routeByProfile = handleLoggedIn;
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
  }
}

bootstrap();
