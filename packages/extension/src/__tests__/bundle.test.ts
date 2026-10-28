import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

/** Any property, any call: enough for module-level code that touches `vscode`. */
function stub(): unknown {
  const fn = function () { return proxy }
  const proxy: unknown = new Proxy(fn, { get: () => proxy, apply: () => proxy })
  return proxy
}

const dist = fileURLToPath(new URL('../../dist/extension.js', import.meta.url))

describe('host bundle (dist/extension.js, built by `pnpm build`)', () => {
  it.skipIf(!existsSync(dist))('loads with every dependency bundled', () => {
    const loader = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown }
    const load = loader._load
    loader._load = function (this: unknown, request: string, ...rest: unknown[]) {
      return request === 'vscode' ? stub() : load.call(this, request, ...rest)
    }
    try {
      const ext = createRequire(import.meta.url)(dist) as { activate?: unknown }
      expect(typeof ext.activate).toBe('function')
    } finally {
      loader._load = load
    }
  })
})
