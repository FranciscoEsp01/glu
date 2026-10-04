import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
const names = ['health', 'operations-admin', 'billing', 'stripe-webhook', 'paid-ai', 'transcribe'];
for (const name of names) {
  const output = await build({
    entryPoints: [`supabase/functions/${name}/index.ts`],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    external: ['stripe', '@supabase/supabase-js'],
  });
  const source = output.outputFiles[0].text
    .replaceAll('from "stripe"', 'from "npm:stripe@23.0.0"')
    .replaceAll('from "@supabase/supabase-js"', 'from "npm:@supabase/supabase-js@2.117.2"');
  mkdirSync(`release/backend/${name}`, { recursive: true });
  writeFileSync(`release/backend/${name}/index.ts`, source);
}
console.log('Funciones sin secretos listas en release/backend para el editor de Supabase.');
