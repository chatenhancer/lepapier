import { spawn, spawnSync } from 'node:child_process';

const host = process.env.LEPAPIER_PROD_E2E_HOST || '127.0.0.1';
const port = process.env.LEPAPIER_PROD_E2E_PORT || '4174';

run(getNpmCommand(), ['run', 'ci:build-pages-release']);

const preview = spawn(getViteCommand(), [
  'preview',
  '--host',
  host,
  '--port',
  port,
  '--outDir',
  'dist/docs'
], {
  stdio: 'inherit'
});

preview.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    preview.kill(signal);
  });
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status ?? 'unknown status'}`);
  }
}

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function getViteCommand() {
  return process.platform === 'win32' ? 'vite.cmd' : 'vite';
}
