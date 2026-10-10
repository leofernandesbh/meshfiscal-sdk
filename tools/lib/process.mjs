import { spawn } from 'node:child_process';

export async function run(command, argumentsList, options = {}) {
  const { cwd = process.cwd(), env = process.env, stdio = 'inherit' } = options;

  await new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      cwd,
      env,
      stdio,
      shell: false,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${argumentsList.join(' ')} failed with ${signal ? `signal ${signal}` : `exit code ${String(code)}`}`,
        ),
      );
    });
  });
}

export async function capture(command, argumentsList, options = {}) {
  const { cwd = process.cwd(), env = process.env } = options;
  const chunks = [];
  const errorChunks = [];

  await new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => errorChunks.push(chunk));
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${argumentsList.join(' ')} failed with ${signal ? `signal ${signal}` : `exit code ${String(code)}`}: ${Buffer.concat(errorChunks).toString('utf8')}`,
        ),
      );
    });
  });

  return Buffer.concat(chunks).toString('utf8');
}

export async function pnpm(argumentsList, options = {}) {
  if (process.env.npm_execpath?.includes('pnpm')) {
    await run(process.execPath, [process.env.npm_execpath, ...argumentsList], options);
    return;
  }

  await run('corepack', ['pnpm', ...argumentsList], options);
}

export async function pnpmCapture(argumentsList, options = {}) {
  if (process.env.npm_execpath?.includes('pnpm')) {
    return capture(process.execPath, [process.env.npm_execpath, ...argumentsList], options);
  }

  return capture('corepack', ['pnpm', ...argumentsList], options);
}
