<template>
  <a
    href="/api/download"
    class="inline-block p-2 text-sm font-bold tracking-wider text-white transition rounded"
    :class="disabled ? 'bg-blue-300 pointer-events-none' : 'bg-blue-500'"
  >
    <div class="flex items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-6 h-6"
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
      <span class="ml-2">Download</span>
    </div>
  </a>
</template>

<script>
export default {
  props: {
    disabled: {
      type: Boolean,
      default: false
    }
  }
}
</script>
