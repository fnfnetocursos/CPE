/**
 * Login UI — script clássico (sem ES modules).
 * Garante feedback visual e autenticação mesmo se app.js falhar ao carregar.
 */
(function () {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  /** Exibe mensagem sempre visível na tela de login */
  function showLoginMessage(message, type) {
    var alertEl = $('login-alert');
    var statusEl = $('login-status');

    if (!message) {
      if (alertEl) {
        alertEl.textContent = '';
        alertEl.classList.add('hidden');
        alertEl.style.display = 'none';
      }
      if (statusEl) statusEl.textContent = '';
      return;
    }

    var cssType = type || 'error';

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
  }

  function showSection(sectionId) {
    document.querySelectorAll('.app-section').forEach(function (section) {
      section.classList.add('hidden');
    });
    var target = $(sectionId);
    if (target) target.classList.remove('hidden');
  }

  function validateConfig() {
    var cfg = window.APP_CONFIG || {};

    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      throw new Error(
        'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY na Vercel.'
      );
    }

    if (
      cfg.SUPABASE_URL.indexOf('seu-projeto') >= 0 ||
      cfg.SUPABASE_ANON_KEY.indexOf('sua-chave') >= 0
    ) {
      throw new Error('Credenciais Supabase ainda estão com valores padrão em js/config.js.');
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error(
        'Biblioteca Supabase não carregou. Verifique conexão ou bloqueador de anúncios.'
      );
    }
  }

  function formatAuthError(message) {
    var msg = message || '';
    if (msg.indexOf('Invalid login credentials') >= 0) return 'E-mail ou senha incorretos.';
    if (msg.indexOf('Email not confirmed') >= 0) {
      return 'E-mail não confirmado. Desabilite "Confirm email" no Supabase (Authentication → Email).';
    }
    if (msg.indexOf('Failed to fetch') >= 0 || msg.indexOf('NetworkError') >= 0) {
      return 'Não foi possível conectar ao Supabase. Verifique URL e chave anon.';
    }
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

    if (perfilResult.error) {
      throw new Error('Erro ao carregar perfil: ' + perfilResult.error.message);
    }

    if (!perfilResult.data) {
      throw new Error(
        'Usuário autenticado, mas sem perfil. Execute sql/seed-dados-demo.sql no Supabase.'
      );
    }

    return { user: user, perfil: perfilResult.data };
  }

  /** Destinos após login conforme perfil */
  var DESTINOS = {
    MASTER: { section: 'section-master', label: 'Painel Master — Gestão de Empresas' },
    ADMIN: { section: 'section-admin', label: 'Painel Admin — Dashboard da Empresa' },
    COLABORADOR: { section: 'section-colaborador', label: 'Registro de Ponto' }
  };

  function routeAfterLogin(perfil) {
    var destino = DESTINOS[perfil.perfil];

    if (!destino) {
      showSection('section-login');
      showLoginMessage('Perfil "' + perfil.perfil + '" não reconhecido.', 'error');
      return;
    }

    showLoginMessage('Login realizado! Abrindo: ' + destino.label, 'success');
    showSection(destino.section);

    window.dispatchEvent(
      new CustomEvent('cpe:logged-in', { detail: { user: window.__CPE_SESSION__.user, perfil: perfil } })
    );
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    var email = $('login-email').value.trim();
    var senha = $('login-senha').value;
    var btn = $('btn-login-submit');

    if (!email || !senha) {
      showLoginMessage('Informe e-mail e senha.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';
    showLoginMessage('Validando credenciais...', 'info');

    try {
      validateConfig();

      var supabase = window.supabase.createClient(
        window.APP_CONFIG.SUPABASE_URL,
        window.APP_CONFIG.SUPABASE_ANON_KEY
      );

      showLoginMessage('Conectando ao Supabase...', 'info');

      var authResult = await supabase.auth.signInWithPassword({
        email: email,
        password: senha
      });

      if (authResult.error) {
        throw new Error(formatAuthError(authResult.error.message));
      }

      showLoginMessage('Autenticado! Carregando perfil...', 'info');

      var session = await loadPerfilData(supabase);
      window.__CPE_SUPABASE__ = supabase;
      window.__CPE_SESSION__ = session;

      routeAfterLogin(session.perfil);
    } catch (err) {
      console.error('[Login]', err);
      showLoginMessage(err.message || 'Falha no login.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }

  function initLoginUI() {
    var form = $('form-login');
    if (form) {
      form.addEventListener('submit', handleLoginSubmit);
    }

    try {
      validateConfig();
      showLoginMessage('Sistema pronto. Use master@demo.com / senha 123456 para teste.', 'info');
    } catch (err) {
      showLoginMessage(err.message, 'error');
    }

    // Carrega módulo principal (telas admin/master/colaborador)
    import('./js/app.js').catch(function (err) {
      console.error('[App module]', err);
      showLoginMessage(
        'Login funciona, mas telas avançadas falharam ao carregar: ' + err.message,
        'error'
      );
    });
  }

  window.showLoginMessage = showLoginMessage;
  window.CPE_showSection = showSection;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginUI);
  } else {
    initLoginUI();
  }
})();
