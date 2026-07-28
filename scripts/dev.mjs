import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const viteEntry = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const electronEntry = join(projectRoot, 'node_modules', 'electron', 'cli.js');
const devServerUrl = 'http://127.0.0.1:5173';
const npmScript = process.env.npm_execpath;
const npmExecutable = npmScript === undefined
  ? (process.platform === 'win32' ? process.env.ComSpec : 'npm')
  : process.execPath;
const npmArguments = npmScript === undefined
  ? (process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd run build:electron'] : ['run', 'build:electron'])
  : [npmScript, 'run', 'build:electron'];

const electronBuild = spawnSync(npmExecutable, npmArguments, {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});

if (electronBuild.status !== 0) {
  process.exit(electronBuild.status ?? 1);
}

const renderer = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--strictPort'], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});

function waitForRenderer() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 15_000;
    const check = async () => {
      try {
        await fetch(devServerUrl);
        resolve();
      } catch {
        if (renderer.exitCode !== null || Date.now() >= deadline) {
          reject(new Error('Vite did not start within 15 seconds.'));
          return;
        }
        setTimeout(() => void check(), 100);
      }
    };
    void check();
  });
}

try {
  await waitForRenderer();
} catch (error) {
  renderer.kill();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const electron = spawn(process.execPath, [electronEntry, '.'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    SMARTSPACE_DEV_SERVER_URL: devServerUrl,
  },
  stdio: 'inherit',
});

let shuttingDown = false;
const shutdown = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  renderer.kill();
  if (electron.exitCode === null) electron.kill();
  process.exitCode = exitCode;
};

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));
electron.on('error', () => shutdown(1));
electron.on('exit', (code) => shutdown(code ?? 1));
