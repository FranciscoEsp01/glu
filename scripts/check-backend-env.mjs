import { readFileSync } from 'node:fs';
const file = process.argv[2] || 'supabase/.env.local';
let source;
try {
  source = readFileSync(file, 'utf8');
} catch {
  console.error(`Falta ${file}. Copia supabase/.env.example y completa los secretos.`);
  process.exit(1);
}
const values = Object.fromEntries(
  source
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ''),
      ];
    }),
);
const invalid = [];
const rules = {
  STRIPE_SECRET_KEY: /^sk_(test|live)_\S+$/,
  STRIPE_WEBHOOK_SECRET: /^whsec_\S+$/,
  STRIPE_PRICE_PRO: /^price_\S+$/,
  STRIPE_PRICE_PLUS: /^price_\S+$/,
  STRIPE_PORTAL_CONFIGURATION_ID: /^bpc_\S+$/,
  GEMINI_API_KEY: /\S+/,
  DEEPGRAM_API_KEY: /\S+/,
};
for (const [name, rule] of Object.entries(rules))
  if (
    !rule.test(values[name] || '') ||
    /(your|replace|example|placeholder|cambia|xxx)/i.test(values[name] || '')
  )
    invalid.push(name);
if (values.STRIPE_PRICE_PRO === values.STRIPE_PRICE_PLUS)
  invalid.push('STRIPE_PRICE_PRO/PLUS deben ser distintos');
for (const name of ['BILLING_RETURN_URL', 'BILLING_ALLOWED_ORIGINS']) {
  try {
    const parts = (values[name] || '').split(',');
    for (const part of parts) {
      const url = new URL(part.trim());
      if (
        !['https:', 'http:', 'tauri:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.hostname.includes('example') ||
        url.hostname.includes('*') ||
        url.search ||
        url.hash
      )
        throw Error();
      if (
        url.protocol === 'http:' &&
        !['127.0.0.1', 'localhost', 'tauri.localhost'].includes(url.hostname)
      )
        throw Error();
    }
  } catch {
    invalid.push(name);
  }
}
if (invalid.length) {
  console.error(
    'Configuración pendiente (no se muestran secretos):\n' +
      invalid.map((n) => '• ' + n).join('\n'),
  );
  process.exit(1);
}
console.log(
  'Variables del backend completas. No verifica saldo, permisos, precios activos ni despliegue remoto.',
);
