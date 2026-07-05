/**
 * Gera js/config.js a partir das variáveis de ambiente da Vercel.
 * Executado no build: npm run build
 */
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

const content = `/**
 * Configuração global do Supabase.
 * Gerado automaticamente em build. Para desenvolvimento local,
 * edite manualmente ou defina SUPABASE_URL e SUPABASE_ANON_KEY.
 */
window.APP_CONFIG = {
  SUPABASE_URL: '${url}',
  SUPABASE_ANON_KEY: '${key}'
};
`;

const outPath = path.join(__dirname, '..', 'js', 'config.js');
fs.writeFileSync(outPath, content, 'utf8');
console.log('config.js gerado em', outPath);
