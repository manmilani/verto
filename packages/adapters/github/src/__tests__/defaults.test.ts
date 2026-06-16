import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseVertoConfig } from '@verto/config'
import { githubAdapterDefaults } from '../defaults.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const configPath = resolve(__dirname, '../../defaults.verto.config.jsonc')

describe('githubAdapterDefaults', () => {
  it('matches defaults.verto.config.jsonc exactly', () => {
    const fromFile = parseVertoConfig(readFileSync(configPath, 'utf8'))
    expect(githubAdapterDefaults).toEqual(fromFile)
  })
})
