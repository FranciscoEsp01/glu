import { spawnSync } from 'node:child_process';
const profile = process.env.GLU_NOTARY_PROFILE;
const file = process.argv[2];
if (!profile || !file?.endsWith('.dmg'))
  throw new Error(
    'Uso: GLU_NOTARY_PROFILE=perfil node scripts/notarize-mac.mjs ruta/Glu.dmg. El DMG debe estar firmado previamente con Developer ID.',
  );
function run(command, args) {
  const r = spawnSync(command, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
run('hdiutil', ['verify', file]);
run('xcrun', ['notarytool', 'submit', file, '--keychain-profile', profile, '--wait']);
run('xcrun', ['stapler', 'staple', file]);
run('xcrun', ['stapler', 'validate', file]);
console.log('Notarización y ticket del DMG verificados.');
