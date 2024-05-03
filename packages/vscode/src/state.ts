import path from 'node:path'
import type { LoadedSlidevData } from '@slidev/parser/fs'
import { load } from '@slidev/parser/fs'
import { computed, onScopeDispose, ref, shallowRef, watchEffect } from '@vue/runtime-core'
import type { ExtensionContext } from 'vscode'
import { workspace } from 'vscode'
import { configuredPort } from './config'
import { useLogger } from './views/logger'

export const extCtx = shallowRef<ExtensionContext>(undefined!)

export const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''

export const activeEntry = ref<string | null>(null)
export const activeUserRoot = computed(() => activeEntry.value ? path.dirname(activeEntry.value) : null)
export const activeSlidevData = shallowRef<LoadedSlidevData | null>(null)

export const detectedPort = ref<number | null>(null)
export const previewPort = computed(() => detectedPort.value ?? configuredPort.value)
export const previewOrigin = computed(() => `http://localhost:${previewPort.value}`)
export const previewUrl = computed(() => `${previewOrigin.value}?embedded=true`)

export async function useGlobalStates() {
  const logger = useLogger()

  let pendingUpdate: { cancelled: boolean } | null = null

  async function updateSlidevData() {
    const startMs = Date.now()
    pendingUpdate && (pendingUpdate.cancelled = true)
    const thisUpdate = pendingUpdate = { cancelled: false }
    const newSlidevData = activeEntry.value ? await load(activeUserRoot.value!, activeEntry.value) : null
    if (!thisUpdate.cancelled) {
      activeSlidevData.value = newSlidevData
      logger.info(`Slidev data updated in ${Date.now() - startMs}ms.`)
    }
  }
  watchEffect(updateSlidevData)

  const fsWatcher = workspace.createFileSystemWatcher('**/*.md')
  fsWatcher.onDidChange(updateSlidevData)

  onScopeDispose(() => {
    fsWatcher.dispose()
  })
}
