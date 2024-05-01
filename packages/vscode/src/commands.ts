import { move } from '@antfu/utils'
import { save as slidevSave } from '@slidev/parser/fs'
import type { SlideInfo } from '@slidev/types'
import { onScopeDispose } from '@vue/runtime-core'
import type { Disposable } from 'vscode'
import { Position, Range, Selection, TextEditorRevealType, Uri, commands, env, window, workspace } from 'vscode'
import { useEditingSlideNo } from './composables/useEditingSlideNo'
import { useEditingSlideSource } from './composables/useEditingSlideSource'
import { configuredPort, previewSync } from './config'
import { activeSlidevData, previewPort } from './state'
import { getPort } from './utils/getPort'
import { usePreviewWebview } from './views/previewWebview'
import { useTerminal } from './views/terminal'

export function useCommands() {
  const disposables: Disposable[] = []
  onScopeDispose(() => disposables.forEach(d => d.dispose()))
  function registerCommand(command: string, callback: (...args: any[]) => any) {
    disposables.push(commands.registerCommand(command, callback))
  }

  async function gotoSlide(filepath: string, index: number) {
    const slide = activeSlidevData.value?.markdownFiles[filepath]?.slides[index]
    if (!slide)
      return

    const editor = await window.showTextDocument(await workspace.openTextDocument(Uri.file(filepath)))

    const cursorPos = new Position(slide.contentStart, 0)
    editor.selection = new Selection(cursorPos, cursorPos)

    const startPos = new Position(slide.start, 0)
    const endPos = new Position(slide.end, 0)
    const slideRange = new Range(startPos, endPos)
    editor.revealRange(slideRange, TextEditorRevealType.AtTop)
  }

  registerCommand('slidev.goto', gotoSlide)
  registerCommand('slidev.next', () => {
    const { markdown, index } = useEditingSlideSource()
    gotoSlide(markdown.value!.filepath, index.value + 1)
  })
  registerCommand('slidev.prev', () => {
    const { markdown, index } = useEditingSlideSource()
    gotoSlide(markdown.value!.filepath, index.value - 1)
  })

  registerCommand('slidev.move-up', async (slide: SlideInfo) => {
    const data = activeSlidevData.value
    const { index } = slide.importChain?.[0] ?? slide.source
    if (!data || index <= 0)
      return
    move(data.entry.slides, index, index - 1)
    slidevSave(data.entry)
  })
  registerCommand('slidev.move-down', async (slide: SlideInfo) => {
    const data = activeSlidevData.value
    const { index } = slide.importChain?.[0] ?? slide.source
    if (!data || index >= data.slides.length - 1)
      return
    move(data.entry.slides, index, index + 1)
    slidevSave(data.entry)
  })

  registerCommand('slidev.refresh-preview', () => {
    const { refresh } = usePreviewWebview()
    refresh()
  })

  registerCommand('slidev.config-port', async () => {
    const port = await window.showInputBox({
      prompt: 'Slidev Preview Port',
      value: configuredPort.value.toString(),
      validateInput: (v) => {
        if (!v.match(/^\d+$/))
          return 'Port should be a number'
        if (+v < 1024 || +v > 65535)
          return 'Port should be between 1024 and 65535'
        return null
      },
    })
    if (!port)
      return
    configuredPort.value = +port
  })

  registerCommand('slidev.start-dev', async () => {
    const port = await getPort()
    const { executeCommand, showTerminal } = useTerminal()

    executeCommand(`pnpm slidev --port ${port}`)
    showTerminal()

    const { refresh } = usePreviewWebview()
    setTimeout(refresh, 2000)
  })

  registerCommand('slidev.open-in-browser', async () => {
    const no = useEditingSlideNo().value
    env.openExternal(Uri.parse(`http://localhost:${previewPort.value}/${no}`))
  })

  registerCommand('slidev.preview-prev-click', () => usePreviewWebview().prevClick())
  registerCommand('slidev.preview-next-click', () => usePreviewWebview().nextClick())
  registerCommand('slidev.preview-prev-slide', () => usePreviewWebview().prevSlide())
  registerCommand('slidev.preview-next-slide', () => usePreviewWebview().nextSlide())

  registerCommand('slidev.enable-preview-sync', () => (previewSync.value = true))
  registerCommand('slidev.disable-preview-sync', () => (previewSync.value = false))
}
