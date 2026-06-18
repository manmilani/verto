export class ConfigMissingError extends Error {
  constructor(message = 'Verto: .vscode/verto.config.jsonc not found. Run Setup to create it.') {
    super(message)
    this.name = 'ConfigMissingError'
  }
}

export class ConfigIncompleteError extends Error {
  constructor(
    message = 'Verto: Setup is incomplete — run Setup to finish configuring field mappings.',
  ) {
    super(message)
    this.name = 'ConfigIncompleteError'
  }
}

export class ConfigInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigInvalidError'
  }
}

export function isSetupRequiredConfigError(
  err: unknown,
): err is ConfigMissingError | ConfigIncompleteError | ConfigInvalidError {
  return (
    err instanceof ConfigMissingError ||
    err instanceof ConfigIncompleteError ||
    err instanceof ConfigInvalidError
  )
}

/** Auto-start wizard only for missing/incomplete config — not schema-invalid files. */
export function shouldAutoStartSetupForConfigError(
  err: unknown,
): err is ConfigMissingError | ConfigIncompleteError {
  return err instanceof ConfigMissingError || err instanceof ConfigIncompleteError
}
