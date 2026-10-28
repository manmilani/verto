import { describe, it, expect, vi } from 'vitest'
import { SkipPrompt } from '../host/skipPrompt.js'

describe('SkipPrompt', () => {
  it('remembers "Skip and load" for the same config and list; asks again when either changes', async () => {
    const ask = vi.fn(async () => true)
    const prompt = new SkipPrompt(ask)
    expect(await prompt.confirm('cfg1', 'w')).toBe(true)
    expect(await prompt.confirm('cfg1', 'w')).toBe(true)
    expect(ask).toHaveBeenCalledOnce()
    await prompt.confirm('cfg2', 'w')
    await prompt.confirm('cfg2', 'w2')
    expect(ask).toHaveBeenCalledTimes(3)
  })

  it('Cancel is not remembered', async () => {
    const ask = vi.fn(async () => false)
    const prompt = new SkipPrompt(ask)
    expect(await prompt.confirm('cfg', 'w')).toBe(false)
    expect(await prompt.confirm('cfg', 'w')).toBe(false)
    expect(ask).toHaveBeenCalledTimes(2)
  })

  it('a prompt that fails is not reused by the next load', async () => {
    const ask = vi.fn<(w: string) => Promise<boolean>>().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(true)
    const prompt = new SkipPrompt(ask)
    await expect(prompt.confirm('cfg', 'w')).rejects.toThrow('x')
    expect(await prompt.confirm('cfg', 'w')).toBe(true)
  })

  it('concurrent loads with the same config and list share one prompt', async () => {
    let answer!: (ok: boolean) => void
    const ask = vi.fn(() => new Promise<boolean>(resolve => { answer = resolve }))
    const prompt = new SkipPrompt(ask)
    const a = prompt.confirm('cfg', 'w')
    const b = prompt.confirm('cfg', 'w')
    answer(true)
    expect(await Promise.all([a, b])).toEqual([true, true])
    expect(ask).toHaveBeenCalledOnce()
  })

  it('a run that went stale while the prompt was open gets false and remembers nothing', async () => {
    let answer!: (ok: boolean) => void
    const ask = vi.fn(() => new Promise<boolean>(resolve => { answer = resolve }))
    const prompt = new SkipPrompt(ask)
    const stale = prompt.confirm('cfg', 'w', () => false)
    answer(true)
    expect(await stale).toBe(false)
    ask.mockImplementation(async () => false)
    expect(await prompt.confirm('cfg', 'w')).toBe(false)
    expect(ask).toHaveBeenCalledTimes(2)
  })

  it('the current run sharing a prompt with a stale one remembers the answer', async () => {
    let answer!: (ok: boolean) => void
    const ask = vi.fn(() => new Promise<boolean>(resolve => { answer = resolve }))
    const prompt = new SkipPrompt(ask)
    const stale = prompt.confirm('cfg', 'w', () => false)
    const current = prompt.confirm('cfg', 'w', () => true)
    answer(true)
    expect(await Promise.all([stale, current])).toEqual([false, true])
    expect(await prompt.confirm('cfg', 'w')).toBe(true)
    expect(ask).toHaveBeenCalledOnce()
  })
})
