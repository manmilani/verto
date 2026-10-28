import * as esbuild from 'esbuild'
await esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['vscode'],
  // ESM builds first: UMD builds (e.g. jsonc-parser's `main`) hide their internal requires from esbuild.
  mainFields: ['module', 'main'],
  sourcemap: true,
})
