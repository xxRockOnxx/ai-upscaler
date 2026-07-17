<template>
  <div class="mt-8">
    <div class="font-medium tracking-wide text-neutral-500 mb-3">
      Frame Interpolation <span class="text-neutral-500/60">(2× FPS)</span>
    </div>

    <div
      class="flex border border-mist"
      :class="{ 'opacity-40 pointer-events-none': disabled }"
    >
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="flex-1 px-4 py-2 font-semibold transition-colors border-r border-mist last:border-r-0"
        :class="modelValue === opt.value
          ? 'bg-ink text-white'
          : 'bg-white text-ink hover:bg-mist'"
        @click="$emit('change', opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'none'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['change'])

const options = [
  { value: 'none', label: 'None' },
  { value: 'rife', label: 'RIFE' },
  { value: 'cain', label: 'CAIN' }
]
</script>
