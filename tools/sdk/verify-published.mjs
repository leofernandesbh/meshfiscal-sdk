import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';

import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { capture } from '../lib/process.mjs';

const evidence = JSON.parse(await readFile(process.argv[2], 'utf8'));
assert(/^\d+\.\d+\.\d+$/.test(evidence.sdkVersion));
const metadata = JSON.parse(
  await capture('npm', ['view', `@meshfiscal/sdk@${evidence.sdkVersion}`, '--json']),
);
assert.equal(
  metadata.dist.integrity,
  evidence.integrity,
  'Published package differs from reviewed tarball',
);
assert(
  metadata.dist.attestations?.url && metadata.dist.attestations?.provenance,
  'Published npm provenance unavailable',
);
assert(metadata.dist.signatures?.length > 0, 'Published registry signature unavailable');
console.log(
  `Published @meshfiscal/sdk ${evidence.sdkVersion}: integrity, registry signature and provenance metadata verified.`,
);

const directory = await mkdtemp(resolve(tmpdir(), 'meshfiscal-registry-verification-'));
try {
  await writeFile(
    resolve(directory, 'package.json'),
    JSON.stringify({
      name: 'meshfiscal-release-verification',
      version: '0.0.0-synthetic',
      private: true,
    }),
  );
  await capture(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      `@meshfiscal/sdk@${evidence.sdkVersion}`,
    ],
    { cwd: directory },
  );
  console.log(await capture('npm', ['audit', 'signatures'], { cwd: directory }));
} finally {
  await rm(directory, { recursive: true, force: true });
}
