/**
 * Aplicação principal — roteamento SPA por perfil de usuário
 */
import { login, logout, initSession, state } from './auth.js';
import { validateConfig } from './supabase-client.js';
import { showSection, setAlert, closeModal, showToast, $ } from './utils/ui.js';
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
      setAlert(
        $('#login-alert'),
        `Perfil "${perfil || 'indefinido'}" não reconhecido. Contate o administrador.`,
        'error'
      );
  }
}

function setLoginLoading(loading) {
  const btn = $('#btn-login-submit');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Entrando...' : 'Entrar';
}

async function handleLogin(e) {
  e.preventDefault();

  const email = $('#login-email').value.trim();
  const senha = $('#login-senha').value;
  const alertEl = $('#login-alert');

  if (!email || !senha) {
    setAlert(alertEl, 'Informe e-mail e senha.', 'error');
    return;
  }

  setAlert(alertEl, null);
  setLoginLoading(true);

  try {
    validateConfig();
    await login(email, senha);
    setAlert(alertEl, 'Login realizado com sucesso!', 'success');
    routeByProfile();
  } catch (err) {
    console.error('[Login]', err);
    setAlert(alertEl, err.message || 'Falha no login.', 'error');
    showToast(err.message || 'Falha no login.', 'error');
  } finally {
    setLoginLoading(false);
  }
}

async function handleLogout() {
  destroyColaborador();
  await logout();
  showSection('section-login');
  $('#form-login').reset();
  setAlert($('#login-alert'), null);
}

function bindGlobalEvents() {
  $('#form-login')?.addEventListener('submit', handleLogin);
  $('#modal-close')?.addEventListener('click', closeModal);
  $('#modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  window.addEventListener('app:logout', handleLogout);
}

function checkConfigOnLoad() {
  try {
    validateConfig();
  } catch (err) {
    setAlert($('#login-alert'), err.message, 'error');
  }
}

async function bootstrap() {
  bindGlobalEvents();
  checkConfigOnLoad();

  try {
    validateConfig();
    const perfil = await initSession();
    if (perfil) routeByProfile();
    else showSection('section-login');
  } catch (err) {
    console.error('[Bootstrap]', err);
    showSection('section-login');
    setAlert($('#login-alert'), err.message || 'Erro ao iniciar aplicação.', 'error');
  }
}

bootstrap();
