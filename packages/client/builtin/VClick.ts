/**
 * <v-click/> click animations component
 *
 * Learn more: https://sli.dev/guide/animations.html#click-animations
 */

import type { PropType, VNode } from 'vue'
import { Text, defineComponent, h } from 'vue'
import VClicks from './VClicks'

export default defineComponent({
  props: {
    at: {
      type: [Number, String],
      default: null, // should be 'flow' after #1279 is merged
    },
    hide: {
      type: Boolean,
      default: false,
    },
    fade: {
      type: Boolean,
      default: false,
    },
    wrapTextAs: {
      type: Function as PropType<(text: VNode) => VNode>,
      default: (text: VNode) => h('span', text),
    },
  },
  render() {
    return h(
      VClicks,
      {
        every: 99999,
        at: this.at,
        hide: this.hide,
        fade: this.fade,
      },
      {
        default: () =>
          this.$slots.default?.().map(v =>
            v.type === Text
              ? this.wrapTextAs(v)
              : v,
          ),
      },
    )
  },
})
