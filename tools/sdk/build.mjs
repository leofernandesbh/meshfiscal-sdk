import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { run } from '../lib/process.mjs';

const sdkDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/sdk');
const sourceDirectory = resolve(sdkDirectory, 'src');
const commonJsDirectory = resolve(sdkDirectory, 'dist/cjs');

async function typescriptFiles(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await typescriptFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      paths.push(path);
    }
  }
  return paths;
}

await rm(resolve(sdkDirectory, 'dist'), { recursive: true, force: true });
await run(
  process.execPath,
  [fileURLToPath(import.meta.resolve('typescript/lib/tsc.js')), '-p', 'tsconfig.esm.json'],
  { cwd: sdkDirectory },
);

for (const sourcePath of await typescriptFiles(sourceDirectory)) {
  const relativePath = relative(sourceDirectory, sourcePath).replace(/\.ts$/, '.cjs');
  const outputPath = resolve(commonJsDirectory, relativePath);
  const source = await readFile(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      sourceMap: false,
      target: ts.ScriptTarget.ES2024,
      verbatimModuleSyntax: false,
    },
    fileName: sourcePath,
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    transpiled.outputText.replaceAll(".js'", ".cjs'").replaceAll('.js"', '.cjs"'),
    'utf8',
  );
  const declarationPath = resolve(
    sdkDirectory,
    'dist/esm',
    relative(sourceDirectory, sourcePath).replace(/\.ts$/, '.d.ts'),
  );
  const declarationOutput = outputPath.replace(/\.cjs$/, '.d.cts');
  const declaration = (await readFile(declarationPath, 'utf8'))
    .replaceAll(".js'", ".cjs'")
    .replaceAll('.js"', '.cjs"');
  await writeFile(declarationOutput, declaration, 'utf8');
}
