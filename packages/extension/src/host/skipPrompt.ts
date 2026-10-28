/**
 * Remember-or-ask for the field-check prompt (DESIGN.md §4.6.4): a "Skip and load" answer is
 * remembered for the session until the config or the list changes; concurrent loads with the
 * same config and list share one open prompt. No `vscode` here.
 */
export class SkipPrompt {
  private accepted: string | undefined
  private pending: { key: string; answer: Promise<boolean> } | undefined

  /** `ask` shows `warning` and resolves `true` for "Skip and load", `false` for Cancel. */
  constructor(private readonly ask: (warning: string) => Promise<boolean>) {}

  /**
   * `true` = skip the listed mappings and load; `false` = cancel. If `isCurrent()` is false once
   * the user has answered, the run is stale: `false`, and nothing is remembered.
   */
  async confirm(configKey: string, warning: string, isCurrent: () => boolean = () => true): Promise<boolean> {
    const key = `${configKey}\n${warning}`
    if (this.accepted === key) return true
    let pending = this.pending
    if (pending?.key !== key) {
      pending = { key, answer: this.ask(warning) }
      this.pending = pending
    }
    let ok: boolean
    try {
      ok = await pending.answer
    } finally {
      if (this.pending === pending) this.pending = undefined
    }
    if (!isCurrent()) return false
    if (ok) this.accepted = key
    return ok
  }
}
