import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const frontend = await createServer();
await frontend.listen();
frontend.printUrls();
const backend = spawn(process.execPath, ['--watch', 'server/server.js', '--dev'], { stdio: 'inherit' });
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  backend.kill('SIGTERM');
  await frontend.close();
  process.exitCode = code;
}
backend.once('exit', code => stop(code || 0));
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
