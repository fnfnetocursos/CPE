/**
 * Gera js/config.js a partir das variáveis de ambiente da Vercel.
 * Executado no build: npm run build
 *
 * Variáveis aceitas (use uma de cada par):
 *   URL  → SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL | VITE_SUPABASE_URL
 *   KEY  → SUPABASE_ANON_KEY | NEXT_PUBLIC_SUPABASE_ANON_KEY | VITE_SUPABASE_ANON_KEY
 */
const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '..', 'js', 'config.js');

function firstEnv(names) {
  for (const name of names) {
    const value = (process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

const url = firstEnv(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL']);
const key = firstEnv([
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY'
]);

function escapeJs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function isPlaceholder(content) {
  return (
    content.includes('seu-projeto') ||
    content.includes('sua-chave-anon') ||
    content.includes("SUPABASE_URL: ''") ||
    content.includes('SUPABASE_URL: ""')
  );
}

function writeConfig(supabaseUrl, supabaseKey, source) {
  const content = `/**
 * Configuração global do Supabase.
 * Origem: ${source}
 */
window.APP_CONFIG = {
  SUPABASE_URL: '${escapeJs(supabaseUrl)}',
  SUPABASE_ANON_KEY: '${escapeJs(supabaseKey)}'
};
`;
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`config.js gerado (${source}).`);
}

try {
  if (url && key) {
    writeConfig(url, key, 'variáveis de ambiente da Vercel');
    process.exit(0);
  }

  // Sem env vars: preserva config.js existente se já tiver credenciais reais
  if (fs.existsSync(outPath)) {
    const existing = fs.readFileSync(outPath, 'utf8');
    if (!isPlaceholder(existing)) {
      console.warn('');
      console.warn('AVISO: variáveis de ambiente não encontradas na Vercel.');
      console.warn('Mantendo js/config.js existente (já contém credenciais).');
      console.warn('Recomendado: Settings → Environment Variables →');
      console.warn('  SUPABASE_URL');
      console.warn('  SUPABASE_ANON_KEY');
      console.warn('');
      process.exit(0);
    }
  }

  // Fallback: build não falha; app exibirá erro de configuração no login
  writeConfig('https://seu-projeto.supabase.co', 'sua-chave-anon-aqui', 'placeholder — configure env vars');
  console.warn('');
  console.warn('AVISO: SUPABASE_URL e SUPABASE_ANON_KEY não definidas.');
  console.warn('Build concluído, mas o login NÃO funcionará até configurar:');
  console.warn('  Vercel → Settings → Environment Variables');
  console.warn('  ou editar js/config.js manualmente.');
  console.warn('');
  process.exit(0);
} catch (err) {
  console.error('Erro ao gerar config.js:', err.message);
  process.exit(1);
}
