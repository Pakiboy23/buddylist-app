import { spawn } from 'node:child_process';

const command = process.argv.slice(2).join(' ').trim();

if (!command) {
  console.error('Usage: node scripts/run-without-no-color.mjs "<command>"');
  process.exit(1);
}

const env = { ...process.env };
delete env.NO_COLOR;

const child = spawn(command, {
  env,
  shell: true,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
