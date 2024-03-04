<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { nextTick, onMounted, ref, watch } from 'vue'
import { editorHeight, editorWidth, showEditor, isEditorVertical as vertical } from '../state'
import { useCodeMirror } from '../setup/codemirror'
import { currentSlideNo, openInEditor } from '../logic/nav'
import { useDynamicSlide } from '../composables/useSlide'
import IconButton from './IconButton.vue'

const props = defineProps<{
  resize?: boolean
}>()

const tab = ref<'content' | 'note'>('content')
const contentInput = ref<HTMLTextAreaElement>()
const noteInput = ref<HTMLTextAreaElement>()

const { content, note } = useDynamicSlide(currentSlideNo)

function close() {
  showEditor.value = false
}

onMounted(async () => {
  const contentEditor = await useCodeMirror(
    contentInput,
    content,
    {
      mode: 'markdown',
      lineWrapping: true,
      // @ts-expect-error missing types
      highlightFormatting: true,
      fencedCodeBlockDefaultMode: 'javascript',
    },
  )

  const noteEditor = await useCodeMirror(
    noteInput,
    note,
    {
      mode: 'markdown',
      lineWrapping: true,
      // @ts-expect-error missing types
      highlightFormatting: true,
      fencedCodeBlockDefaultMode: 'javascript',
    },
  )

  watch([tab, vertical], () => {
    nextTick(() => {
      if (tab.value === 'content')
        contentEditor.refresh()
      else
        noteEditor.refresh()
    })
  })

  watch(currentSlideNo, () => {
    contentEditor.clearHistory()
    noteEditor.clearHistory()
  }, { flush: 'post' })
})

const handlerDown = ref(false)
function onHandlerDown() {
  handlerDown.value = true
}
function updateSize(v?: number) {
  if (vertical.value)
    editorHeight.value = Math.min(Math.max(300, v ?? editorHeight.value), window.innerHeight - 200)
  else
    editorWidth.value = Math.min(Math.max(318, v ?? editorWidth.value), window.innerWidth - 200)
}
function switchTab(newTab: typeof tab.value) {
  tab.value = newTab
  // @ts-expect-error force cast
  document.activeElement?.blur?.()
}

if (props.resize) {
  useEventListener('pointermove', (e) => {
    if (handlerDown.value) {
      updateSize(vertical.value
        ? window.innerHeight - e.pageY
        : window.innerWidth - e.pageX)
    }
  }, { passive: true })
  useEventListener('pointerup', () => {
    handlerDown.value = false
  })
  useEventListener('resize', () => {
    updateSize()
  })
}
</script>

<template>
  <div
    v-if="resize" class="fixed bg-gray-400 select-none opacity-0 hover:opacity-10 z-100"
    :class="vertical ? 'left-0 right-0 w-full h-10px' : 'top-0 bottom-0 w-10px h-full'" :style="{
      opacity: handlerDown ? '0.3' : undefined,
      bottom: vertical ? `${editorHeight - 5}px` : undefined,
      right: !vertical ? `${editorWidth - 5}px` : undefined,
      cursor: vertical ? 'row-resize' : 'col-resize',
    }" @pointerdown="onHandlerDown"
  />
  <div
    class="shadow bg-main p-4 grid grid-rows-[max-content_1fr] h-full overflow-hidden"
    :class="resize ? 'border-l border-gray-400 border-opacity-20' : ''"
    :style="resize ? {
      height: vertical ? `${editorHeight}px` : undefined,
      width: !vertical ? `${editorWidth}px` : undefined,
    } : {}"
  >
    <div class="flex pb-2 text-xl -mt-1">
      <div class="mr-4 rounded flex">
        <IconButton
          title="Switch to content tab" :class="tab === 'content' ? 'text-primary' : ''"
          @click="switchTab('content')"
        >
          <carbon:account />
        </IconButton>
        <IconButton
          title="Switch to notes tab" :class="tab === 'note' ? 'text-primary' : ''"
          @click="switchTab('note')"
        >
          <carbon:align-box-bottom-right />
        </IconButton>
      </div>
      <span class="text-2xl pt-1">
        {{ tab === 'content' ? 'Slide' : 'Notes' }}
      </span>
      <div class="flex-auto" />
      <template v-if="resize">
        <IconButton v-if="vertical" title="Dock to right" @click="vertical = false">
          <carbon:open-panel-right />
        </IconButton>
        <IconButton v-else title="Dock to bottom" @click="vertical = true">
          <carbon:open-panel-bottom />
        </IconButton>
      </template>
      <IconButton title="Open in editor" @click="openInEditor()">
        <carbon:launch />
      </IconButton>
      <IconButton title="Close" @click="close">
        <carbon:close />
      </IconButton>
    </div>
    <div class="overflow-hidden">
      <div v-show="tab === 'content'" class="w-full h-full">
        <textarea ref="contentInput" placeholder="Create slide content..." />
      </div>
      <div v-show="tab === 'note'" class="w-full h-full">
        <textarea ref="noteInput" placeholder="Write some notes..." />
      </div>
    </div>
  </div>
</template>

<style lang="postcss">
.CodeMirror {
  @apply px-3 py-2 h-full overflow-hidden bg-transparent font-mono text-sm z-0;
}
</style>
