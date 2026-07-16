<template>
  <div
    class="p-4 shadow"
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
      return 'bg-[#3C8CE7] text-white'

    case 'warning':
      return 'bg-yellow-50 text-yellow-700'

    case 'error':
      return 'bg-red-50 text-red-500'

    default:
      return ''
  }
})
</script>
