<template>
  <button
    class="inline-flex items-center justify-center gap-2.5 px-6 py-2 font-semibold border border-ink transition-colors"
    :class="disabled
      ? 'opacity-30 pointer-events-none'
      : 'hover:bg-ink hover:text-white'"
    :disabled="disabled"
    @click="$emit('cancel')"
  >
    Cancel
  </button>
</template>

<script setup>
defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['cancel'])
</script>
