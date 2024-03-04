import type { SlideInfo, SlidePatch } from '@slidev/types'
import { useFetch, watchImmediate, watchThrottled } from '@vueuse/core'
import type { Ref } from 'vue'
import { computed, reactive, ref, toRef, watch } from 'vue'

export interface UseSlideInfo {
  info: Ref<SlideInfo | null>
  patch: (data: SlidePatch) => Promise<SlideInfo>
}

const cache: Record<string, UseSlideInfo> = {}

export function useSlide(no: number): UseSlideInfo {
  if (cache[no])
    return cache[no]

  const url = `/@slidev/slide/${no}.json`
  const { data: info } = useFetch(url).json<SlideInfo>().get()

  const patch = async (patch: SlidePatch) => {
    return await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      },
    ).then(r => r.json())
  }

  if (__DEV__) {
    import.meta.hot?.on('slidev:update-slide', (payload) => {
      if (payload.no === no)
        info.value = payload.data
    })
    import.meta.hot?.on('slidev:update-note', (payload) => {
      if (payload.no === no && info.value?.note?.trim() !== payload.note?.trim())
        info.value = { ...info.value!, ...payload }
    })
  }

  return cache[no] = {
    info,
    patch,
  }
}

export function useDynamicSlide(no: Ref<number>) {
  const info = ref<SlideInfo | null>(null)
  watchImmediate(no, (newNo, _oldNo, onCleanup) => {
    const slide = useSlide(newNo)
    info.value = slide.info.value
    onCleanup(
      watch(
        slide.info,
        (newInfo, _oldInfo, onCleanup) => {
          newInfo = newInfo ? reactive(newInfo) : null
          info.value = newInfo
          newInfo && onCleanup(
            watchThrottled(
              [toRef(newInfo, 'content'), toRef(newInfo, 'note')],
              ([newContent, newNote], [oldContent, oldNote]) => {
                slide.patch({
                  content: newContent.trim() === oldContent.trim() ? undefined : newContent,
                  note: newNote?.trim() === oldNote?.trim() ? undefined : newNote,
                })
              },
              { throttle: 500 },
            ),
          )
        },
      ),
    )
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
        return info.value?.content ?? ''
      },
      set(v) {
        info.value && (info.value.content = v)
      },
    }),
  }
}
