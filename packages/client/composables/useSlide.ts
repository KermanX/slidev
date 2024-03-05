import type { SlideInfo, SlidePatch } from '@slidev/types'
import { watchDebounced } from '@vueuse/core'
import type { Ref } from 'vue'
import { computed, shallowReactive, shallowRef, toRef, watch } from 'vue'
import { total } from '../logic/nav'

const cache: Record<string, Ref<SlideInfo | null>> = {}

export function useSlide(no: number): Ref<SlideInfo | null> {
  if (no < 1 || no > total.value)
    return shallowRef(null)

  if (cache[no])
    return cache[no]

  const url = `/@slidev/slide/${no}.json`

  const info = shallowRef<SlideInfo | null>(null)

  const patch = async (patch: SlidePatch) => {
    return (await fetch(
      url,
      {
        method: 'POST',
        body: JSON.stringify(patch),
      },
    )).json()
  }

  fetch(url, { method: 'GET' })
    .then(async (data) => {
      info.value = shallowReactive(await data.json())
    })

  watch(info, (newInfo, _oldInfo, onCleanup) => {
    newInfo && onCleanup(watchDebounced(
      [toRef(newInfo, 'content'), toRef(newInfo, 'note')],
      async ([newContent, newNote], [oldContent, oldNote]) => {
        newInfo.noteHTML = await patch({
          content: newContent.trim() === oldContent.trim() ? undefined : newContent,
          note: newNote?.trim() === oldNote?.trim() ? undefined : newNote,
        })
      },
      {
        debounce: 200,
      },
    ))
  })

  if (__DEV__) {
    import.meta.hot?.on('slidev:update-slide', (payload) => {
      if (payload.no === no)
        info.value = shallowReactive(payload.data)
    })
    import.meta.hot?.on('slidev:update-note', (payload) => {
      if (payload.no === no && info.value?.note?.trim() !== payload.note?.trim())
        info.value = shallowReactive({ ...info.value!, ...payload })
    })
  }

  return cache[no] = info
}

export function useDynamicSlide(no: Ref<number>) {
  const info = computed(() => {
    useSlide(no.value - 1)
    useSlide(no.value + 1)
    return useSlide(no.value).value
  })
  return {
    info,
    content: computed({
      get() {
        return info.value?.content ?? ''
      },
      set(v) {
        info.value && (info.value.content = v)
      },
    }),
    note: computed({
      get() {
        return info.value?.note ?? ''
      },
      set(v) {
        info.value && (info.value.note = v)
      },
    }),
  }
}
