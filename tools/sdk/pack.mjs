import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { capture } from '../lib/process.mjs';

export async function packSdk(sdkDirectory, destination) {
  const environment = { ...process.env };
  delete environment.npm_config_manage_package_manager_versions;
  const [packed] = JSON.parse(
    await capture(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', destination],
      { cwd: sdkDirectory, env: environment },
    ),
  );
  const allowed =
    /^(?:package\.json|LICENSE|NOTICE|README\.md|CHANGELOG\.md|compatibility\.json|dist\/(?:esm\/.*\.(?:js|d\.ts)|cjs\/.*\.(?:cjs|d\.cts)))$/;
  for (const file of packed.files)
    assert(allowed.test(file.path), `Unexpected package file: ${file.path}`);
  for (const required of [
    'LICENSE',
    'NOTICE',
    'README.md',
    'CHANGELOG.md',
    'dist/esm/index.js',
    'dist/esm/index.d.ts',
    'dist/cjs/index.cjs',
    'dist/cjs/index.d.cts',
  ])
    assert(
      packed.files.some((file) => file.path === required),
      `Missing package file: ${required}`,
    );
  const tarball = resolve(destination, packed.filename);
  const sha256 = createHash('sha256')
    .update(await readFile(tarball))
    .digest('hex');
  return { packed, tarball, sha256 };
}
