import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const electronPackage = resolve(projectRoot, 'node_modules', 'electron');
const pathFile = join(electronPackage, 'path.txt');
const binaryName = existsSync(pathFile) ? readFileSync(pathFile, 'utf8').trim() : undefined;
const electronBinary = binaryName === undefined ? process.execPath : resolve(electronPackage, 'dist', binaryName);
const electronArguments = binaryName === undefined
  ? [join(electronPackage, 'cli.js'), '.']
  : ['.'];

if (!existsSync(electronBinary)) {
  console.error(`Electron binary not found: ${electronBinary}`);
  process.exit(1);
}

const smokeEnvironment = {
  ...process.env,
  SMARTSPACE_SMOKE_TEST: '1',
};
delete smokeEnvironment.SMARTSPACE_DEV_SERVER_URL;

const electron = spawn(electronBinary, electronArguments, {
  cwd: projectRoot,
  env: smokeEnvironment,
  stdio: 'inherit',
});

const timeout = setTimeout(() => {
  console.error('Electron startup smoke check timed out after 30 seconds.');
  electron.kill();
  process.exit(1);
}, 30_000);

electron.on('error', (error) => {
  clearTimeout(timeout);
  console.error(error);
  process.exit(1);
});

electron.on('exit', (code) => {
  clearTimeout(timeout);
  if (code === 0) {
    console.log('Electron startup smoke check passed.');
  }
  process.exit(code ?? 1);
});
