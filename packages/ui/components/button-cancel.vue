<template>
  <button
    class="p-2 text-sm font-bold tracking-wider text-black transition rounded"
    :class="disabled ? 'bg-gray-100 pointer-events-none text-opacity-50' : 'bg-gray-200'"
    :disabled="disabled"
    @click="$emit('cancel')"
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
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
      <span class="ml-2">Cancel</span>
    </div>
  </button>
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
