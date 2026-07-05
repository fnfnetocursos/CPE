/**
 * Gera js/config.js a partir das variáveis de ambiente da Vercel.
 * Executado no build: npm run build
 */
const fs = require('fs');
const path = require('path');

const url = (process.env.SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_ANON_KEY || '').trim();

if (!url || !key) {
  console.error('');
  console.error('ERRO DE BUILD: variáveis obrigatórias não definidas na Vercel.');
  console.error('  - SUPABASE_URL');
  console.error('  - SUPABASE_ANON_KEY');
  console.error('Settings → Environment Variables → redeploy');
  console.error('');
  process.exit(1);
}

function escapeJs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const content = `/**
 * Configuração global do Supabase (gerado no build da Vercel).
 */
window.APP_CONFIG = {
  SUPABASE_URL: '${escapeJs(url)}',
  SUPABASE_ANON_KEY: '${escapeJs(key)}'
};
`;

const outPath = path.join(__dirname, '..', 'js', 'config.js');
fs.writeFileSync(outPath, content, 'utf8');
console.log('config.js gerado com sucesso.');
