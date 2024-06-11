// Ported from https://github.com/antfu/vscode-vite/blob/main/src/terminal.ts

import { ref, useAbsolutePath } from 'reactive-vscode'
import type { Terminal } from 'vscode'
import { Uri, window } from 'vscode'

import type { SlidevProject } from '../projects'
import { getSlidesTitle } from '../utils/getSlidesTitle'

export function useTerminal(project: SlidevProject) {
  const terminal = ref<Terminal | null>(null)

  function isTerminalActive() {
    return terminal.value && terminal.value.exitStatus == null
  }

  function ensureTerminal() {
    if (isTerminalActive())
      return
    terminal.value = window.createTerminal({
      name: getSlidesTitle(project.data),
      cwd: project.userRoot,
      iconPath: {
        light: Uri.file(useAbsolutePath('dist/res/logo-mono.svg').value),
        dark: Uri.file(useAbsolutePath('dist/res/logo-mono-dark.svg').value),
      },
      isTransient: true,
    })
  }

  async function sendText(text: string) {
    ensureTerminal()
    terminal.value!.sendText(text)
  }

  async function showTerminal() {
    ensureTerminal()
    terminal.value!.show()
  }

  function closeTerminal() {
    if (isTerminalActive()) {
      terminal.value!.sendText('\x03')
      terminal.value!.dispose()
      terminal.value = null
    }
  }

  return {
    terminal,
    isTerminalActive,
    showTerminal,
    sendText,
    closeTerminal,
  }
}
