import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const viteEntry = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const config = join(projectRoot, 'electron.vite.config.ts');

for (const buildMode of ['main', 'preload']) {
  const result = spawnSync(process.execPath, [viteEntry, 'build', '--config', config], {
    cwd: projectRoot,
    env: {
      ...process.env,
      VITE_BUILD_MODE: buildMode,
    },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
