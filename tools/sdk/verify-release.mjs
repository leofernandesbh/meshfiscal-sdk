// MIT — MeshFiscal SDK release tooling.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { capture, run } from '../lib/process.mjs';
import { packSdk } from './pack.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(await readFile(resolve(root, 'apps/sdk/package.json'), 'utf8'));
const repository = /^git\+https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\.git$/.exec(
  manifest.repository.url,
)?.[1];
assert(repository, 'Exact public GitHub repository must be configured');
assert.equal(manifest.repository.directory, 'apps/sdk');
if (process.env.GITHUB_REPOSITORY) assert.equal(process.env.GITHUB_REPOSITORY, repository);
assert(/^\d+\.\d+\.\d+$/.test(process.env.RELEASE_VERSION ?? ''), 'Reviewed version is required');
assert.equal(manifest.version, process.env.RELEASE_VERSION);
assert(/^[a-f0-9]{64}$/.test(process.env.RELEASE_SHA256 ?? ''), 'Reviewed SHA-256 is required');

if (process.argv[2]) {
  assert(process.env.ACTIONS_ID_TOKEN_REQUEST_URL, 'OIDC must be available before publish');
  assert(
    !process.env.NODE_AUTH_TOKEN && !process.env.NPM_TOKEN,
    'Long-lived npm tokens are forbidden',
  );
  const evidencePath = resolve(process.argv[2]);
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  assert.equal(evidence.repository, repository);
  assert.equal(evidence.sourceCommit, process.env.GITHUB_SHA);
  assert.equal(evidence.sdkVersion, manifest.version);
  assert.equal(evidence.sha256, process.env.RELEASE_SHA256);
  assert.equal(evidence.provenance, 'not_published');
  const bytes = await readFile(
    resolve(dirname(evidencePath), `meshfiscal-sdk-${manifest.version}.tgz`),
  );
  assert.equal(createHash('sha256').update(bytes).digest('hex'), evidence.sha256);
  assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, evidence.integrity);
  console.log('OIDC, public source commit and exact reviewed tarball verified.');
} else {
  const directory = await mkdtemp(resolve(tmpdir(), 'meshfiscal-public-sdk-'));
  try {
    const { packed, tarball, sha256 } = await packSdk(resolve(root, 'apps/sdk'), directory);
    assert.equal(
      sha256,
      process.env.RELEASE_SHA256,
      'Public build differs from the reviewed matrix tarball',
    );
    const consumer = resolve(directory, 'consumer');
    await mkdir(consumer);
    await writeFile(
      resolve(consumer, 'package.json'),
      JSON.stringify({
        name: 'meshfiscal-public-sdk-consumer',
        version: '0.0.0-synthetic',
        private: true,
        type: 'module',
      }),
    );
    await capture('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
      cwd: consumer,
    });
    const assertions = `
const assert = require('node:assert/strict');
assert.equal(sdk.SDK_VERSION, ${JSON.stringify(manifest.version)});
assert.equal(sdk.preferWait(5), 'wait=5');
assert.equal(sdk.idempotencyKey('nfse', 'ERP-100'), sdk.idempotencyKey('nfse', 'ERP-100'));
let requested;
const client = sdk.createMeshFiscalClient({baseUrl:'https://api.example.test', fetchImplementation: async (request) => { requested=request; return new Response(JSON.stringify({status:'live'}),{status:200,headers:{'Content-Type':'application/json'}}); }});
assert.equal((await client.GET('/health/live')).response.status, 200);
assert.equal(requested.url, 'https://api.example.test/health/live');
globalThis.window={};
assert.throws(()=>sdk.createMeshFiscalClient({baseUrl:'https://api.example.test'}), /server-side/);
`;
    await writeFile(
      resolve(consumer, 'consumer.cjs'),
      `const sdk=require('@meshfiscal/sdk'); (async()=>{${assertions}})().catch(error=>{console.error(error);process.exitCode=1;});`,
    );
    await writeFile(
      resolve(consumer, 'consumer.mjs'),
      `import * as sdk from '@meshfiscal/sdk'; import {createRequire} from 'node:module'; const require=createRequire(import.meta.url); ${assertions}`,
    );
    for (const extension of ['cjs', 'mjs'])
      await run(process.execPath, [`consumer.${extension}`], { cwd: consumer });
    const types = `import {createMeshFiscalClient, type components} from '@meshfiscal/sdk';
const client=createMeshFiscalClient({baseUrl:'https://api.example.test'});
void client.GET('/health/live');
declare const quota: components['schemas']['UsageQuotaResponse'];
const units: string=quota.netUnits; void units;
// @ts-expect-error Decimal strings cannot become number.
const unsafe: number=quota.netUnits; void unsafe;
// @ts-expect-error Internal routes are never exported.
void client.GET('/internal/v1/support-grants');
`;
    for (const extension of ['mts', 'cts'])
      await writeFile(resolve(consumer, `consumer.${extension}`), types);
    await run(
      process.execPath,
      [
        fileURLToPath(import.meta.resolve('typescript/lib/tsc.js')),
        '--strict',
        '--noEmit',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        '--target',
        'ES2024',
        '--lib',
        'ES2024,DOM,DOM.Iterable',
        'consumer.mts',
        'consumer.cts',
      ],
      { cwd: consumer },
    );
    const sbom = await capture('npm', ['sbom', '--sbom-format=cyclonedx'], { cwd: consumer });
    assert.equal(JSON.parse(sbom).bomFormat, 'CycloneDX');
    const signatures = await capture('npm', ['audit', 'signatures'], { cwd: consumer });
    assert(/verified|audited/.test(signatures));
    const evidence = {
      sdkVersion: manifest.version,
      repository,
      sourceCommit: process.env.GITHUB_SHA ?? null,
      sha256,
      integrity: packed.integrity,
      packageFiles: packed.files.map((file) => file.path),
      esm: 'passed',
      cjs: 'passed',
      typescript: 'passed',
      registrySignatures: signatures.trim(),
      provenance: 'not_published',
      sbomSha256: createHash('sha256').update(sbom).digest('hex'),
    };
    const output = process.env.SDK_EVIDENCE_DIRECTORY;
    assert(output, 'Evidence output directory is required');
    await mkdir(output, { recursive: true });
    await writeFile(resolve(output, packed.filename), await readFile(tarball));
    await writeFile(resolve(output, 'sdk-consumer.cdx.json'), sbom);
    await writeFile(resolve(output, 'sdk-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(
      `Public SDK build and ESM/CJS/TypeScript consumers passed (${sha256}); provenance remains unpublished.`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
