import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const identity = config.bundle?.macOS?.signingIdentity;
const result = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
  encoding: 'utf8',
});
const hasDeveloperID = /Developer ID Application:/.test(result.stdout || '');
console.log(
  JSON.stringify(
    {
      developerIDAvailable: hasDeveloperID,
      configuredIdentity: !!identity && identity !== '-',
      notarizationProfileConfigured: !!process.env.GLU_NOTARY_PROFILE,
      updaterEnabled: !!config.plugins?.updater,
    },
    null,
    2,
  ),
);
if (!hasDeveloperID || !identity || identity === '-' || !process.env.GLU_NOTARY_PROFILE)
  process.exitCode = 1;
