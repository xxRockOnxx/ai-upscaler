<template>
  <div>
    <div class="flex items-center justify-between">
      <div class="text-sm font-bold tracking-wider md:text-base">
        {{ name }}
      </div>

      <div class="text-xs md:text-sm">
        {{ format(progress) }}%
      </div>
    </div>

    <progress
      class="w-full mt-2 md:mt-4"
      max="100"
      :value="progress"
    />
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

// Replaces the Vue 2 `round` filter removed in Vue 3.
function format (value) {
  return round(value, 1).toFixed(1)
}
</script>

<style scoped>
progress::-webkit-progress-value {
  background-image: linear-gradient( 135deg, #3C8CE7 10%, #00EAFF 100%);
}

progress::-webkit-progress-bar {
  @apply bg-gray-300;
}
</style>
