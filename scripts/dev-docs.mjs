import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appPort = await findOpenPort(Number(process.env.LEPAPIER_APP_DEV_PORT || 5173));
const docsPort = await findOpenPort(Number(process.env.LEPAPIER_DOCS_DEV_PORT || 4321), new Set([appPort]));
const editorDevUrl = `http://127.0.0.1:${appPort}/`;
const children = [];

console.log('Starting Lepapier dev servers:');
console.log(`[docs] landing/docs site, http://127.0.0.1:${docsPort}/`);
console.log(`[editor] writing app, ${editorDevUrl}`);
console.log('[docs] /editor/ redirects to the editor server in local dev.\n');

start('editor', 'npm', ['run', 'dev', '--', '--port', String(appPort), '--strictPort']);
start('docs', 'npm', [
  'exec',
  'astro',
  '--',
  'dev',
  '--config',
  'astro.docs.config.mjs',
  '--host',
  '127.0.0.1',
  '--port',
  String(docsPort),
  '--strictPort',
  '--force'
], {
  PUBLIC_EDITOR_DEV_URL: editorDevUrl
});

function start(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: {
      ...process.env,
      ...env
    },
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  children.push(child);
  prefixStream(child.stdout, name, process.stdout);
  prefixStream(child.stderr, name, process.stderr);
  child.on('exit', (code, signal) => {
    stopChildren(child);
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code || 0);
  });
  child.on('error', (error) => {
    console.error(`[${name}] ${error.message}`);
    stopChildren(child);
    process.exit(1);
  });
}

function prefixStream(stream, name, target) {
  let pending = '';

  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || '';

    for (const line of lines) {
      target.write(line ? `[${name}] ${line}\n` : '\n');
    }
  });
  stream.on('end', () => {
    if (pending) {
      target.write(`[${name}] ${pending}\n`);
    }
  });
}

async function findOpenPort(preferredPort, reservedPorts = new Set()) {
  let port = preferredPort;
  while (reservedPorts.has(port) || !(await isOpenPort(port))) {
    port += 1;
  }
  return port;
}

function isOpenPort(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port, '127.0.0.1');
  });
}

function stopChildren(exitingChild) {
  for (const child of children) {
    if (child === exitingChild || child.killed) continue;
    child.kill('SIGTERM');
  }
}

process.on('SIGINT', () => {
  stopChildren();
  process.exit(130);
});

process.on('SIGTERM', () => {
  stopChildren();
  process.exit(143);
});
