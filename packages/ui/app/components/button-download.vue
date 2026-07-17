<template>
  <a
    href="/api/download"
    class="inline-flex items-center justify-center gap-2.5 px-6 py-2 font-semibold text-white bg-accent transition-colors"
    :class="disabled
      ? 'opacity-30 pointer-events-none'
      : 'hover:bg-indigo-600'"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="size-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
    Download
  </a>
</template>

<script setup>
defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})
</script>
