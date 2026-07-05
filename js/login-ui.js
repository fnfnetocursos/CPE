/**
 * Login UI + navegação shell + fallbacks de dados
 */
(function () {
  'use strict';

  var loginMessageTimer = null;

  var VIEW_TITLES = {
    'master-empresas': 'Empresas',
    'master-perfis': 'Usuários',
    'master-colaboradores': 'Colaboradores',
    'master-jornadas': 'Jornadas',
    'master-feriados': 'Feriados',
    'master-afastamentos': 'Afastamentos',
    'master-registros': 'Registros Ponto',
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

  var USER_INFO_IDS = {
    MASTER: 'master-user-info',
    ADMIN: 'admin-user-info',
    COLABORADOR: 'colab-user-info'
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
      alertEl.className = 'alert alert-error hidden';
      alertEl.style.display = 'none';
    }
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'login-status';
      statusEl.style.display = 'none';
    }
  }

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
      statusEl.style.display = 'block';
      statusEl.textContent = message;
      statusEl.className = 'login-status login-status--' + cssType;
    }

    var hideAfter = autoHideMs;
    if (hideAfter === undefined) hideAfter = cssType === 'error' ? 0 : 3000;
    if (hideAfter > 0) {
      loginMessageTimer = setTimeout(clearLoginMessages, hideAfter);
    }
  }

  /** Limpa TUDO após logout — sem mensagens persistentes */
  function resetSessionUI() {
    clearLoginMessages();

    var toast = $('toast-container');
    if (toast) toast.innerHTML = '';

    Object.keys(USER_INFO_IDS).forEach(function (key) {
      var el = $(USER_INFO_IDS[key]);
      if (el) el.textContent = '';
    });

    var empNome = $('admin-empresa-nome');
    if (empNome) empNome.textContent = 'Painel Admin';

    ['master-page-title', 'admin-page-title', 'colab-page-title'].forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = '';
    });

    document.querySelectorAll('.data-table tbody').forEach(function (tb) {
      tb.innerHTML = '';
    });

    var kpis = $('admin-kpis');
    if (kpis) kpis.innerHTML = '';

    var punchGrid = $('punch-buttons');
    if (punchGrid) punchGrid.innerHTML = '';

    closeModalIfOpen();
  }

  function closeModalIfOpen() {
    var overlay = $('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
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
    if (titleEl && VIEW_TITLES[viewKey]) titleEl.textContent = VIEW_TITLES[viewKey];

    window.dispatchEvent(new CustomEvent('cpe:view-changed', { detail: { view: viewKey } }));
  }

  function setUserInfoForProfile(perfil, session) {
    var infoId = USER_INFO_IDS[perfil.perfil];
    if (infoId && $(infoId)) {
      $(infoId).textContent = (perfil.nome || '') + ' · ' + perfil.perfil;
    }
    if (perfil.perfil === 'ADMIN') {
      var nomeEmp = session.empresaNome || 'Empresa';
      if ($('admin-empresa-nome')) $('admin-empresa-nome').textContent = nomeEmp;
    }
  }

  function validateConfig() {
    var cfg = window.APP_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      throw new Error('Supabase não configurado.');
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Biblioteca Supabase não carregou.');
    }
  }

  function formatAuthError(message) {
    var msg = message || '';
    if (msg.indexOf('Invalid login credentials') >= 0) return 'E-mail ou senha incorretos.';
    if (msg.indexOf('Email not confirmed') >= 0) return 'E-mail não confirmado no Supabase.';
    if (msg.indexOf('Failed to fetch') >= 0) return 'Não foi possível conectar ao Supabase.';
    return msg || 'Falha na autenticação.';
  }

  async function loadPerfilData(supabase) {
    var userResult = await supabase.auth.getUser();
    if (userResult.error) throw userResult.error;
    var user = userResult.data.user;
    if (!user) throw new Error('Usuário não encontrado.');

    var perfilResult = await supabase.from('perfis').select('*').eq('id', user.id).maybeSingle();
    if (perfilResult.error) throw new Error('Erro perfil: ' + perfilResult.error.message);
    if (!perfilResult.data) throw new Error('Sem perfil. Execute seed-dados-demo.sql.');

    var empresaNome = null;
    if (perfilResult.data.empresa_id) {
      var empRes = await supabase
        .from('empresas')
        .select('razao_social')
        .eq('id', perfilResult.data.empresa_id)
        .maybeSingle();
      empresaNome = empRes.data?.razao_social || null;
    }

    return { user: user, perfil: perfilResult.data, empresaNome: empresaNome };
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  async function shellLoadMaster(viewKey) {
    var sb = window.__CPE_SUPABASE__;
    if (!sb) return;

    if (viewKey === 'master-empresas' || !viewKey) {
      var tbody = document.querySelector('#table-empresas tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
      var res = await sb.from('empresas').select('*').order('razao_social');
      if (res.error) {
        tbody.innerHTML = '<tr><td colspan="5">Erro: ' + res.error.message + '</td></tr>';
        return;
      }
      if (!res.data.length) {
        tbody.innerHTML = '<tr><td colspan="5">Nenhuma empresa.</td></tr>';
        return;
      }
      tbody.innerHTML = res.data.map(function (e) {
        return '<tr><td>' + e.razao_social + '</td><td>' + e.cnpj + '</td><td>' +
          (e.email_admin || '—') + '</td><td>' + fmtDate(e.created_at) + '</td><td>—</td></tr>';
      }).join('');
    }
  }

  async function shellLoadAdmin(perfil) {
    var sb = window.__CPE_SUPABASE__;
    var empresaId = perfil.empresa_id;
    if (!sb || !empresaId) return;

    var kpis = $('admin-kpis');
    if (kpis) {
      kpis.innerHTML = '<div class="kpi-card"><div class="kpi-card__label">Carregando...</div></div>';
    }

    var colRes = await sb.from('colaboradores_detalhes').select('*').eq('empresa_id', empresaId);
    var jorRes = await sb.from('jornadas_trabalho').select('*').eq('empresa_id', empresaId);
    var colabs = colRes.data || [];
    var ativos = colabs.filter(function (c) { return c.ativo; }).length;

    if (kpis) {
      kpis.innerHTML =
        '<div class="kpi-card kpi-card--success"><div class="kpi-card__label">Colaboradores Ativos</div><div class="kpi-card__value">' +
        ativos + '</div></div>' +
        '<div class="kpi-card"><div class="kpi-card__label">Jornadas</div><div class="kpi-card__value">' +
        (jorRes.data?.length || 0) + '</div></div>';
    }

    await shellLoadAdminColaboradores(empresaId);
    await shellLoadAdminJornadas(empresaId);
  }

  async function shellLoadAdminColaboradores(empresaId) {
    var sb = window.__CPE_SUPABASE__;
    var tbody = document.querySelector('#table-colaboradores tbody');
    if (!sb || !tbody) return;

    tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    var colRes = await sb.from('colaboradores_detalhes').select('*').eq('empresa_id', empresaId);
    if (colRes.error) {
      tbody.innerHTML = '<tr><td colspan="6">Erro: ' + colRes.error.message + '</td></tr>';
      return;
    }
    var colabs = colRes.data || [];
    if (!colabs.length) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhum colaborador.</td></tr>';
      return;
    }

    var userIds = colabs.map(function (c) { return c.user_id; });
    var perfRes = await sb.from('perfis').select('id, nome').in('id', userIds);
    var perfMap = {};
    (perfRes.data || []).forEach(function (p) { perfMap[p.id] = p.nome; });

    tbody.innerHTML = colabs.map(function (c) {
      return '<tr><td>' + (perfMap[c.user_id] || '—') + '</td><td>' + (c.matricula || '—') +
        '</td><td>—</td><td>' + fmtDate(c.data_admissao) + '</td><td>' +
        (c.ativo ? 'Ativo' : 'Inativo') + '</td><td>—</td></tr>';
    }).join('');
  }

  async function shellLoadAdminJornadas(empresaId) {
    var sb = window.__CPE_SUPABASE__;
    var tbody = document.querySelector('#table-jornadas tbody');
    if (!sb || !tbody) return;

    var res = await sb.from('jornadas_trabalho').select('*').eq('empresa_id', empresaId);
    if (res.error || !res.data?.length) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhuma jornada.</td></tr>';
      return;
    }
    tbody.innerHTML = res.data.map(function (j) {
      return '<tr><td>' + j.descricao + '</td><td>' + String(j.entrada_prevista).slice(0, 5) +
        '</td><td>' + String(j.saida_prevista).slice(0, 5) + '</td><td>' + j.carga_diaria_minutos +
        '</td><td>' + j.tolerancia_minutos + ' min</td><td>—</td></tr>';
    }).join('');
  }

  async function shellLoadColaborador(userId, empresaId) {
    var sb = window.__CPE_SUPABASE__;
    var tbody = document.querySelector('#table-batidas-hoje tbody');
    if (!sb || !tbody) return;

    var hoje = new Date();
    var iso = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
      String(hoje.getDate()).padStart(2, '0');

    var res = await sb.from('registros_ponto').select('*')
      .eq('user_id', userId).eq('empresa_id', empresaId)
      .eq('data_registro', iso).order('hora_registro');

    if (res.error) {
      tbody.innerHTML = '<tr><td colspan="4">Erro: ' + res.error.message + '</td></tr>';
      return;
    }
    if (!res.data?.length) {
      tbody.innerHTML = '<tr><td colspan="4">Nenhuma batida hoje.</td></tr>';
      return;
    }
    tbody.innerHTML = res.data.map(function (r) {
      return '<tr><td>' + String(r.hora_registro).slice(0, 8) + '</td><td>' + r.tipo_registro +
        '</td><td>' + (r.nome_terminal_local || '—') + '</td><td>' + (r.ip_equipamento || '—') + '</td></tr>';
    }).join('');
  }

  var DESTINOS = {
    MASTER: { section: 'section-master', view: 'master-empresas' },
    ADMIN: { section: 'section-admin', view: 'admin-dashboard' },
    COLABORADOR: { section: 'section-colaborador', view: 'colab-ponto' }
  };

  function waitForApp(ms) {
    return new Promise(function (resolve) {
      if (window.__CPE_APP_READY__) return resolve(true);
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      window.addEventListener('cpe:app-ready', function () { finish(true); }, { once: true });
      setTimeout(function () { finish(false); }, ms || 6000);
    });
  }

  async function activateAppAfterLogin(perfil, session) {
    var ready = await waitForApp(6000);
    if (ready && window.__CPE_routeByProfile) {
      await window.__CPE_routeByProfile();
      return;
    }

    window.dispatchEvent(new CustomEvent('cpe:logged-in'));

    ready = await waitForApp(4000);
    if (ready && window.__CPE_routeByProfile) {
      await window.__CPE_routeByProfile();
      return;
    }

    if (perfil.perfil === 'MASTER' && !window.__CPE_APP_READY__) {
      await shellLoadMaster('master-empresas');
    } else if (perfil.perfil === 'ADMIN') await shellLoadAdmin(perfil);
    else if (perfil.perfil === 'COLABORADOR') {
      await shellLoadColaborador(session.user.id, perfil.empresa_id);
    }
  }

  function routeAfterLogin(session) {
    var perfil = session.perfil;
    var destino = DESTINOS[perfil.perfil];
    if (!destino) {
      showLoginMessage('Perfil não reconhecido.', 'error', 0);
      return;
    }

    showLoginMessage('Entrando...', 'info', 1500);
    showSection(destino.section);
    showInternalView(destino.section, destino.view);
    setUserInfoForProfile(perfil, session);
    activateAppAfterLogin(perfil, session);
  }

  async function handleLogoutClick() {
    try {
      if (window.__CPE_handleLogout) {
        await window.__CPE_handleLogout();
        return;
      }
      if (window.__CPE_SUPABASE__) await window.__CPE_SUPABASE__.auth.signOut();
      window.__CPE_SESSION__ = null;
      resetSessionUI();
      showSection('section-login');
      $('form-login')?.reset();
    } catch (err) {
      resetSessionUI();
      showSection('section-login');
    }
  }

  function bindShellNavigation() {
    document.body.addEventListener('click', function (event) {
      var target = event.target.closest('.sidebar__link');
      if (!target) return;

      if (target.id === 'btn-logout-master' || target.id === 'btn-logout-admin' || target.id === 'btn-logout-colab') {
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

      var session = window.__CPE_SESSION__;
      if (!session) return;

      if (viewKey.startsWith('master-')) {
        if (!window.__CPE_APP_READY__ && viewKey === 'master-empresas') {
          shellLoadMaster(viewKey);
        }
        return;
      }

      if (viewKey === 'admin-colaboradores' && session.perfil.empresa_id) {
        shellLoadAdminColaboradores(session.perfil.empresa_id);
      }
      if (viewKey === 'admin-jornadas' && session.perfil.empresa_id) {
        shellLoadAdminJornadas(session.perfil.empresa_id);
      }
      if (viewKey === 'admin-dashboard' && session.perfil.perfil === 'ADMIN') {
        shellLoadAdmin(session.perfil);
      }
      if (viewKey === 'colab-ponto') {
        shellLoadColaborador(session.user.id, session.perfil.empresa_id);
      }
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
    showLoginMessage('Validando...', 'info', 0);

    try {
      validateConfig();
      var supabase = window.supabase.createClient(
        window.APP_CONFIG.SUPABASE_URL,
        window.APP_CONFIG.SUPABASE_ANON_KEY
      );

      var authResult = await supabase.auth.signInWithPassword({ email: email, password: senha });
      if (authResult.error) throw new Error(formatAuthError(authResult.error.message));

      var session = await loadPerfilData(supabase);
      window.__CPE_SUPABASE__ = supabase;
      window.__CPE_SESSION__ = session;

      routeAfterLogin(session);
    } catch (err) {
      showLoginMessage(err.message || 'Falha no login.', 'error', 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }

  function initLoginUI() {
    bindShellNavigation();
    var form = $('form-login');
    if (form) form.addEventListener('submit', handleLoginSubmit);
    clearLoginMessages();
  }

  window.showLoginMessage = showLoginMessage;
  window.clearLoginMessages = clearLoginMessages;
  window.resetSessionUI = resetSessionUI;
  window.CPE_showSection = showSection;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginUI);
  } else {
    initLoginUI();
  }
})();
