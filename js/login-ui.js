/**
 * Login UI + navegação shell
 */
(function () {
  'use strict';

  var loginMessageTimer = null;

  var VIEW_TITLES = {
    'master-empresas': 'Empresas',
    'master-backup': 'Backup CSV',
    'admin-dashboard': 'Dashboard',
    'admin-colaboradores': 'Colaboradores',
    'admin-jornadas': 'Jornadas',
    'admin-feriados': 'Feriados',
    'admin-afastamentos': 'Afastamentos',
    'admin-relatorios': 'Relatórios',
    'admin-terminal': 'Terminal',
    'admin-backup': 'Backup CSV',
    'colab-ponto': 'Registrar Ponto',
    'colab-historico': 'Meu Histórico'
  };

  function $(id) {
    return document.getElementById(id);
  }

  function clearLoginMessages() {
    if (loginMessageTimer) {
      clearTimeout(loginMessageTimer);
      loginMessageTimer = null;
    }
    var alertEl = $('login-alert');
    var statusEl = $('login-status');
    if (alertEl) {
      alertEl.textContent = '';
      alertEl.classList.add('hidden');
      alertEl.style.display = 'none';
    }
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'login-status';
    }
  }

  /** Mensagem temporária — some automaticamente */
  function showLoginMessage(message, type, autoHideMs) {
    if (!message) {
      clearLoginMessages();
      return;
    }

    if (loginMessageTimer) clearTimeout(loginMessageTimer);

    var cssType = type || 'error';
    var alertEl = $('login-alert');
    var statusEl = $('login-status');

    if (alertEl) {
      alertEl.className = 'alert alert-' + cssType;
      alertEl.textContent = message;
      alertEl.classList.remove('hidden');
      alertEl.style.display = 'block';
    }

    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = 'login-status login-status--' + cssType;
    }

    var hideAfter = autoHideMs;
    if (hideAfter === undefined) {
      hideAfter = cssType === 'error' ? 0 : 3500;
    }
    if (hideAfter > 0) {
      loginMessageTimer = setTimeout(clearLoginMessages, hideAfter);
    }
  }

  function showSection(sectionId) {
    document.querySelectorAll('.app-section').forEach(function (section) {
      section.classList.add('hidden');
    });
    var target = $(sectionId);
    if (target) target.classList.remove('hidden');

    if (sectionId !== 'section-login') {
      clearLoginMessages();
    }
  }

  function showInternalView(sectionId, viewKey) {
    var section = $(sectionId);
    if (!section) return;

    var prefix = sectionId.replace('section-', '');
    section.querySelectorAll('[id^="view-' + prefix + '-"]').forEach(function (panel) {
      panel.classList.add('hidden');
    });

    var panel = $('view-' + viewKey);
    if (panel) panel.classList.remove('hidden');

    section.querySelectorAll('.sidebar__link[data-view]').forEach(function (link) {
      link.classList.toggle('active', link.dataset.view === viewKey);
    });

    var titleEl = $(prefix + '-page-title');
    if (titleEl && VIEW_TITLES[viewKey]) {
      titleEl.textContent = VIEW_TITLES[viewKey];
    }

    window.dispatchEvent(new CustomEvent('cpe:view-changed', { detail: { view: viewKey } }));
  }

  function validateConfig() {
    var cfg = window.APP_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      throw new Error('Supabase não configurado. Verifique js/config.js ou variáveis na Vercel.');
    }
    if (
      String(cfg.SUPABASE_URL).indexOf('seu-projeto') >= 0 ||
      String(cfg.SUPABASE_ANON_KEY).indexOf('sua-chave') >= 0
    ) {
      throw new Error('Credenciais Supabase ainda estão com valores padrão.');
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Biblioteca Supabase não carregou.');
    }
  }

  function formatAuthError(message) {
    var msg = message || '';
    if (msg.indexOf('Invalid login credentials') >= 0) return 'E-mail ou senha incorretos.';
    if (msg.indexOf('Email not confirmed') >= 0) {
      return 'E-mail não confirmado. Desabilite "Confirm email" no Supabase.';
    }
    if (msg.indexOf('Failed to fetch') >= 0) return 'Não foi possível conectar ao Supabase.';
    return msg || 'Falha na autenticação.';
  }

  async function loadPerfilData(supabase) {
    var userResult = await supabase.auth.getUser();
    if (userResult.error) throw userResult.error;
    var user = userResult.data.user;
    if (!user) throw new Error('Usuário não encontrado na sessão.');

    var perfilResult = await supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (perfilResult.error) throw new Error('Erro ao carregar perfil: ' + perfilResult.error.message);
    if (!perfilResult.data) throw new Error('Sem perfil no banco. Execute sql/seed-dados-demo.sql.');

    return { user: user, perfil: perfilResult.data };
  }

  /** Carrega empresas direto (fallback se módulo app falhar) */
  async function loadMasterEmpresasFallback() {
    var tbody = document.querySelector('#table-empresas tbody');
    if (!tbody || !window.__CPE_SUPABASE__) return;

    tbody.innerHTML = '<tr><td colspan="5">Carregando empresas...</td></tr>';

    var res = await window.__CPE_SUPABASE__
      .from('empresas')
      .select('*')
      .order('razao_social');

    if (res.error) {
      tbody.innerHTML = '<tr><td colspan="5">Erro: ' + res.error.message + '</td></tr>';
      return;
    }

    if (!res.data || !res.data.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhuma empresa cadastrada.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(function (e) {
      var created = e.created_at ? String(e.created_at).slice(0, 10).split('-').reverse().join('/') : '—';
      return (
        '<tr><td>' + e.razao_social + '</td><td>' + e.cnpj + '</td><td>' +
        (e.email_admin || '—') + '</td><td>' + created + '</td><td>—</td></tr>'
      );
    }).join('');
  }

  var DESTINOS = {
    MASTER: { section: 'section-master', view: 'master-empresas', label: 'Painel Master' },
    ADMIN: { section: 'section-admin', view: 'admin-dashboard', label: 'Painel Admin' },
    COLABORADOR: { section: 'section-colaborador', view: 'colab-ponto', label: 'Registro de Ponto' }
  };

  function waitForApp(timeoutMs) {
    return new Promise(function (resolve) {
      if (window.__CPE_APP_READY__) {
        resolve(true);
        return;
      }
      var done = false;
      function finish(ok) {
        if (!done) {
          done = true;
          resolve(ok);
        }
      }
      window.addEventListener('cpe:app-ready', function () { finish(true); }, { once: true });
      setTimeout(function () { finish(false); }, timeoutMs || 5000);
    });
  }

  async function activateAppAfterLogin(perfil) {
    var appReady = await waitForApp(5000);

    if (appReady && typeof window.__CPE_routeByProfile === 'function') {
      window.__CPE_routeByProfile();
      return;
    }

    window.dispatchEvent(new CustomEvent('cpe:logged-in'));

    if (perfil.perfil === 'MASTER') {
      await loadMasterEmpresasFallback();
    }
  }

  function routeAfterLogin(perfil) {
    var destino = DESTINOS[perfil.perfil];
    if (!destino) {
      showSection('section-login');
      showLoginMessage('Perfil "' + perfil.perfil + '" não reconhecido.', 'error', 0);
      return;
    }

    showLoginMessage('Login realizado! Abrindo ' + destino.label + '...', 'success', 2000);
    showSection(destino.section);
    showInternalView(destino.section, destino.view);

    var infoEl = $('master-user-info') || $('admin-user-info') || $('colab-user-info');
    if (infoEl) infoEl.textContent = (perfil.nome || '') + ' · ' + perfil.perfil;

    activateAppAfterLogin(perfil);
  }

  async function handleLogoutClick() {
    try {
      if (typeof window.__CPE_handleLogout === 'function') {
        await window.__CPE_handleLogout();
        return;
      }
      if (window.__CPE_SUPABASE__) await window.__CPE_SUPABASE__.auth.signOut();
      window.__CPE_SESSION__ = null;
      showSection('section-login');
      showLoginMessage('Você saiu do sistema.', 'info', 3000);
      $('form-login')?.reset();
    } catch (err) {
      showLoginMessage('Erro ao sair: ' + err.message, 'error', 0);
    }
  }

  function bindShellNavigation() {
    document.body.addEventListener('click', function (event) {
      var target = event.target.closest('.sidebar__link');
      if (!target) return;

      if (
        target.id === 'btn-logout-master' ||
        target.id === 'btn-logout-admin' ||
        target.id === 'btn-logout-colab'
      ) {
        event.preventDefault();
        handleLogoutClick();
        return;
      }

      var viewKey = target.dataset.view;
      if (!viewKey) return;

      var section = target.closest('.app-section');
      if (!section) return;

      event.preventDefault();
      showInternalView(section.id, viewKey);

      if (viewKey === 'master-empresas') loadMasterEmpresasFallback();
    });
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    var email = $('login-email').value.trim();
    var senha = $('login-senha').value;
    var btn = $('btn-login-submit');

    if (!email || !senha) {
      showLoginMessage('Informe e-mail e senha.', 'error', 0);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';
    showLoginMessage('Validando credenciais...', 'info', 0);

    try {
      validateConfig();

      var supabase = window.supabase.createClient(
        window.APP_CONFIG.SUPABASE_URL,
        window.APP_CONFIG.SUPABASE_ANON_KEY
      );

      var authResult = await supabase.auth.signInWithPassword({ email: email, password: senha });
      if (authResult.error) throw new Error(formatAuthError(authResult.error.message));

      showLoginMessage('Autenticado! Carregando perfil...', 'info', 0);

      var session = await loadPerfilData(supabase);
      window.__CPE_SUPABASE__ = supabase;
      window.__CPE_SESSION__ = session;

      routeAfterLogin(session.perfil);
    } catch (err) {
      console.error('[Login]', err);
      showLoginMessage(err.message || 'Falha no login.', 'error', 0);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }

  function initLoginUI() {
    bindShellNavigation();
    var form = $('form-login');
    if (form) form.addEventListener('submit', handleLoginSubmit);

    try {
      validateConfig();
      showLoginMessage('Sistema pronto. master@demo.com / 123456', 'info', 4000);
    } catch (err) {
      showLoginMessage(err.message, 'error', 0);
    }
  }

  window.showLoginMessage = showLoginMessage;
  window.clearLoginMessages = clearLoginMessages;
  window.CPE_showSection = showSection;
  window.CPE_showInternalView = showInternalView;
  window.CPE_loadMasterEmpresas = loadMasterEmpresasFallback;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginUI);
  } else {
    initLoginUI();
  }
})();
