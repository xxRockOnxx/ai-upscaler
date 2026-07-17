<template>
  <div
    class="px-6 py-4 text-base leading-relaxed"
    :class="computedClass"
  >
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: {
    type: String,
    required: true
  }
})

const computedClass = computed(() => {
  switch (props.type) {
    case 'info':
      return 'bg-ink text-white'
    case 'warning':
      return 'border-l-4 border-amber-500 bg-amber-50 text-amber-800'
    case 'error':
      return 'border-l-4 border-red-400 bg-red-50 text-red-700'
    default:
      return ''
  }
})
</script>
