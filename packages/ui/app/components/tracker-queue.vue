<template>
  <div
    class="p-4 space-y-2 text-sm bg-gray-50 md:p-6 md:text-base"
  >
    <div>
      Status: {{ status }}
    </div>

    <div v-if="status === 'waiting'">
      Your position: {{ position }}
    </div>

    <div v-else-if="status === 'processing'">
      Elapsed: {{ elapsed }}
    </div>

    <div>
      People waiting: {{ total }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'

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
