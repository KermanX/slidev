import { existsSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { slash } from '@antfu/utils'
import type { LoadedSlidevData } from '@slidev/parser/fs'
import { load } from '@slidev/parser/fs'
import { computed, markRaw, onScopeDispose, reactive, ref, useVscodeContext, watchEffect } from 'reactive-vscode'
import { commands, window, workspace } from 'vscode'
import { forceEnabled } from './configs'
import { findShallowestPath } from './utils/findShallowestPath'
import { logger } from './views/logger'

export interface SlidevProject {
  readonly entry: string
  readonly userRoot: string
  data: LoadedSlidevData
  port: number | null
}

export const projects = reactive(new Map<string, SlidevProject>())
export const activeEntry = ref<string | null>(null)
export const activeProject = computed(() => activeEntry.value ? projects.get(activeEntry.value) : undefined)
export const activeSlidevData = computed(() => activeProject.value?.data)
export const activeUserRoot = computed(() => activeProject.value?.userRoot)

async function loadExistingProjects() {
  const files = await workspace.findFiles('**/*.md', '**/node_modules/**')
  for (const file of files) {
    const path = slash(file.fsPath)
    if (basename(path) === 'slides.md')
      (await addProjectEffect(path))()
  }
}

export async function rescanProjects() {
  await loadExistingProjects()
  for (const project of projects.values()) {
    if (!existsSync(project.entry)) {
      projects.delete(project.entry)
      if (activeEntry.value === project.entry)
        activeEntry.value = null
    }
  }
  await autoSetActiveEntry()
}

export function useProjects() {
  async function init() {
    await loadExistingProjects()
    await autoSetActiveEntry()
  }
  init()

  // In case all the projects are removed manually, and the user may not want to disable the extension.
  const everHadProjects = ref(false)
  watchEffect(() => {
    if (projects.size > 0)
      everHadProjects.value = true
  })

  useVscodeContext('slidev:enabled', () => {
    const enabled = forceEnabled.value == null ? everHadProjects.value : forceEnabled.value
    logger.info(`Slidev ${enabled ? 'enabled' : 'disabled'}.`)
    return enabled
  })
  useVscodeContext('slidev:hasActiveProject', () => !!activeEntry.value)

  let pendingUpdate: { cancelled: boolean } | null = null

  // TODO: Not sure why file creation is not being detected
  const fsWatcher = workspace.createFileSystemWatcher('**/*.md')
  fsWatcher.onDidChange(async (uri) => {
    const path = slash(uri.fsPath)
    logger.info(`File ${path} changed.`)
    const startMs = Date.now()
    pendingUpdate && (pendingUpdate.cancelled = true)
    const thisUpdate = pendingUpdate = { cancelled: false }
    const effects: (() => void)[] = []
    let maybeNewEntry = path.endsWith('.md') && basename(path).toLowerCase() !== 'readme.md'
    for (const project of projects.values()) {
      if (project.data.watchFiles.includes(path))
        maybeNewEntry = false
      else
        continue

      if (existsSync(project.entry)) {
        const newData = markRaw(await load(project.userRoot, project.entry))
        maybeNewEntry &&= newData.watchFiles.includes(path)
        effects.push(() => {
          project.data = newData
          logger.info(`Project ${project.entry} updated.`)
        })
      }
      else {
        effects.push(() => {
          projects.delete(project.entry)
          logger.info(`Project ${project.entry} removed.`)
          if (activeEntry.value === project.entry) {
            window.showWarningMessage('The active slides file has been deleted. Please choose another one.', 'Choose another one')
              .then(result => result && commands.executeCommand('slidev.choose-entry'))
          }
        })
      }
      if (thisUpdate.cancelled)
        return
    }

    if (basename(path).toLocaleLowerCase() === 'slides.md' && !projects.has(path))
      effects.push(await addProjectEffect(path))

    if (thisUpdate.cancelled)
      return

    effects.map(effect => effect())
    autoSetActiveEntry()
    logger.info(`All affected Slidev projects updated in ${Date.now() - startMs}ms.`)
  })
  onScopeDispose(() => fsWatcher.dispose())
}

export async function addProject(entry: string) {
  if (projects.has(entry)) {
    window.showErrorMessage('Cannot add slides entry: This Markdown has already been a entry.')
    return
  }
  (await addProjectEffect(entry))()
  autoSetActiveEntry()
}

async function addProjectEffect(entry: string) {
  const userRoot = dirname(entry)
  const data = markRaw(await load(userRoot, entry))
  return () => {
    const existing = projects.get(entry)
    if (existing) {
      existing.data = data
    }
    else {
      projects.set(entry, {
        entry,
        userRoot,
        data,
        port: null,
      })
    }
  }
}

async function autoSetActiveEntry() {
  if (!activeEntry.value) {
    const firstKind = findShallowestPath(
      [...projects.keys()].filter(path => basename(path) === 'slides.md'),
    )
    if (firstKind) {
      activeEntry.value = firstKind
      return
    }
    const secondKind = findShallowestPath(projects.keys())
    if (secondKind)
      activeEntry.value = secondKind
  }
}
