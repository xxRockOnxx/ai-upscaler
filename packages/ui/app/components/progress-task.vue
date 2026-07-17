<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <div class="text-sm font-semibold">
        {{ name }}
      </div>
      <div class="text-sm text-neutral-500 tabular-nums">
        {{ format(progress) }}%
      </div>
    </div>

    <div class="h-3 w-full bg-mist">
      <div
        class="h-full bg-accent transition-all duration-300 ease-out"
        :style="{ width: progress + '%' }"
      />
    </div>
  </div>
</template>

<script setup>
import round from 'lodash.round'

defineProps({
  name: {
    type: String,
    required: true
  },

  progress: {
    type: Number,
    default: 0
  }
})

function format (value) {
  return round(value, 1).toFixed(1)
}
</script>
