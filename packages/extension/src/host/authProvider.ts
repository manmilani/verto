import * as vscode from 'vscode'

export async function getGitHubToken(): Promise<string | undefined> {
  const session = await vscode.authentication.getSession(
    'github',
    ['repo', 'read:project'],
    { createIfNone: true },
  )
  return session?.accessToken
}
