<template>
  <div>
    <div class="font-medium tracking-wide text-neutral-500 mb-3">
      Processor
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
    default: 'real-esrgan'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['change'])

const options = [
  { value: 'real-esrgan', label: 'Real-ESRGAN' },
  { value: 'waifu2x', label: 'waifu2x' },
  { value: 'anime4k', label: 'Anime4K' }
]
</script>
