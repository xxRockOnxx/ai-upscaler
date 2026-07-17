<template>
  <div class="border-t border-mist bg-paper px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
    <span class="text-neutral-500 uppercase tracking-wider">
      Status&nbsp;
      <span
        class="font-medium"
        :class="statusClass"
      >{{ status }}</span>
    </span>

    <span
      v-if="status === 'waiting'"
      class="text-neutral-500 uppercase tracking-wider"
    >
      Position&nbsp;<span class="font-medium text-ink">{{ position }}</span>
    </span>

    <span
      v-else-if="status === 'processing'"
      class="text-neutral-500 uppercase tracking-wider"
    >
      Elapsed&nbsp;<span class="font-medium text-ink tabular-nums">{{ elapsed }}</span>
    </span>

    <span class="text-neutral-500 uppercase tracking-wider">
      Waiting&nbsp;<span class="font-medium text-ink">{{ total }}</span>
    </span>

    <span
      v-if="status === 'waiting' || status === 'processing'"
      class="text-neutral-500 uppercase tracking-wider md:ml-auto"
    >
      One video at a time — keep this tab open
    </span>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  status: {
    type: String,
    required: true
  },

  total: {
    type: Number,
    default: 0
  },

  position: {
    type: Number,
    default: null
  },

  processedOn: {
    type: Number,
    default: null
  }
})

const elapsed = ref('00:00:00')
let elapsedInterval = null

const statusClass = computed(() => {
  switch (props.status) {
    case 'processing': return 'text-accent'
    case 'finished': return 'text-green-600'
    case 'failed':
    case 'error': return 'text-accent'
    default: return 'text-ink'
  }
})

function startElapsed () {
  elapsedInterval = setInterval(() => {
    const seconds = (Date.now() - props.processedOn) / 1000
    const s = Math.floor(seconds % 60).toString().padStart(2, '0')
    const m = Math.floor(seconds / 60 % 60).toString().padStart(2, '0')
    const h = Math.floor(seconds / 3600 % 24).toString().padStart(2, '0')
    elapsed.value = `${h}:${m}:${s}`
  }, 1000)
}

watch(() => props.status, (status) => {
  if (status === 'processing') {
    startElapsed()
  } else {
    clearInterval(elapsedInterval)
    elapsed.value = '00:00:00'
  }
})

onBeforeUnmount(() => clearInterval(elapsedInterval))
</script>
