/**
 * Aplicação principal — roteamento SPA por perfil de usuário
 */
import { login, logout, initSession, state } from './auth.js';
import { showSection, setAlert, closeModal, $ } from './utils/ui.js';
import { initMaster } from './views/master.js';
import { initAdmin } from './views/admin.js';
import { initColaborador, destroyColaborador } from './views/colaborador.js';

/** Roteia para a área correta conforme perfil */
function routeByProfile() {
  const perfil = state.perfil?.perfil;
  destroyColaborador();

  switch (perfil) {
    case 'MASTER':
      showSection('section-master');
      initMaster();
      break;
    case 'ADMIN':
      showSection('section-admin');
      initAdmin();
      break;
    case 'COLABORADOR':
      showSection('section-colaborador');
      initColaborador();
      break;
    default:
      showSection('section-login');
      setAlert($('#login-alert'), 'Perfil não reconhecido. Contate o administrador.', 'error');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const senha = $('#login-senha').value;
  const alertEl = $('#login-alert');
  setAlert(alertEl, null);

  try {
    await login(email, senha);
    routeByProfile();
  } catch (err) {
    setAlert(alertEl, err.message || 'Falha no login.', 'error');
  }
}

async function handleLogout() {
  destroyColaborador();
  await logout();
  showSection('section-login');
  $('#form-login').reset();
}

function bindGlobalEvents() {
  $('#form-login')?.addEventListener('submit', handleLogin);
  $('#modal-close')?.addEventListener('click', closeModal);
  $('#modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  window.addEventListener('app:logout', handleLogout);
}

async function bootstrap() {
  bindGlobalEvents();
  try {
    const perfil = await initSession();
    if (perfil) routeByProfile();
    else showSection('section-login');
  } catch {
    showSection('section-login');
  }
}

bootstrap();
