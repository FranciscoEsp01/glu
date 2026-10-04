import { readFileSync } from 'node:fs';
export function readEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .flatMap((line) => {
          const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
          if (!match) return [];
          const value = match[2];
          return [
            [
              match[1],
              /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value.replace(/\s+#.*$/, ''),
            ],
          ];
        }),
    );
  } catch {
    return {};
  }
}
