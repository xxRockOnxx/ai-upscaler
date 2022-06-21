<template>
  <div>
    <div class="flex items-center justify-between">
      <div class="font-bold tracking-wider">
        {{ name }}
      </div>

      <div class="text-sm">
        {{ progress | round(1) }}%
      </div>
    </div>

    <progress
      class="w-full mt-4"
      max="100"
      :value="progress"
    />
  </div>
</template>

<script>
import round from 'lodash.round'

export default {
  filters: {
    round (val, precision) {
      return round(val, precision).toFixed(precision)
    }
  },

  props: {
    name: {
      type: String,
      required: true
    },

    progress: {
      type: Number,
      default: 0
    }
  }
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
