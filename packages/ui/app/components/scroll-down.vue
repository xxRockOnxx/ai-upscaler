<template>
  <button
    type="button"
    class="flex items-center gap-2 bg-ink text-white px-4 py-2.5 text-xs font-medium uppercase tracking-widest shadow-lg transition-opacity hover:opacity-80 bounce"
    aria-label="Scroll down to info"
    @click="scrollDown"
  >
    ↓ Info
  </button>
</template>

<script setup>
const props = defineProps({
  top: {
    type: Number,
    default: 0
  }
})

function scrollDown () {
  window.scrollTo({
    top: props.top,
    behavior: 'smooth'
  })
}
</script>

<style scoped>
.bounce {
  animation: bounce 2.5s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
</style>
