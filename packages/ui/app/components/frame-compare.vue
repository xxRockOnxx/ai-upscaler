<template>
  <div class="flex flex-col h-full">
    <div class="h-20 overflow-x-auto border-b border-mist">
      <div class="flex h-full gap-2 flex-nowrap px-3 py-2">
        <button
          v-for="frame in total"
          :key="frame"
          type="button"
          class="h-full aspect-video shrink-0 overflow-hidden border-2 transition-colors"
          :class="active === frame ? 'border-accent' : 'border-transparent hover:border-mist'"
          @click="active = frame"
        >
          <img
            :src="`/api/frames/${frame}`"
            :alt="`Frame #${frame}`"
            class="w-full h-full object-cover"
          >
        </button>
      </div>
    </div>

    <div
      ref="canvas"
      class="relative w-full flex-1 aspect-video bg-mist"
    >
      <template v-if="active !== null">
        <img
          :src="`/api/frames/${active}`"
          class="absolute inset-0 object-contain w-full h-full bg-white pointer-events-none"
          alt="Original frame"
        >

        <img
          :src="`/api/frames/${active}?enhanced=true`"
          :style="{ clipPath: `polygon(${position}% 0, 100% 0, 100% 100%, ${position}% 100%)` }"
          class="absolute inset-0 object-contain w-full h-full bg-white pointer-events-none"
          alt="Enhanced frame"
        >

        <div
          class="absolute top-2 left-2 text-xs font-medium tracking-widest bg-ink/70 text-white px-1.5 py-0.5 uppercase pointer-events-none"
        >
          Before
        </div>
        <div
          class="absolute top-2 right-2 text-xs font-medium tracking-widest bg-accent text-white px-1.5 py-0.5 uppercase pointer-events-none"
        >
          After 4×
        </div>

        <div
          class="absolute top-0 h-full"
          :style="{ left: `${position}%` }"
        >
          <div class="w-px h-full bg-white mix-blend-difference" />
          <button
            type="button"
            class="absolute w-5 h-5 bg-white border-2 border-ink rounded-full shadow-lg cursor-ew-resize"
            :style="{ top: 'calc(50% - 0.625rem)', left: '-0.625rem' }"
            @mousedown="tracking = true"
          />
        </div>
      </template>

      <div
        v-else
        class="flex items-center justify-center h-full text-neutral-500 text-xs uppercase tracking-widest"
      >
        <span v-if="total === 0">No frames available</span>
        <span v-else>Select a frame above</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps({
  total: {
    type: Number,
    default: 0
  }
})

const canvas = ref(null)
const active = ref(null)
const position = ref(50)
const tracking = ref(false)

function onMouseUp () {
  tracking.value = false
}

function onMouseMove (evt) {
  if (!tracking.value) {
    return
  }

  const rect = canvas.value.getBoundingClientRect()
  const next = (evt.clientX - rect.left) / rect.width * 100

  position.value = Math.min(Math.max(next, 0), 100)
}

onMounted(() => {
  document.body.addEventListener('mousemove', onMouseMove)
  document.body.addEventListener('mouseup', onMouseUp)
})

onBeforeUnmount(() => {
  document.body.removeEventListener('mousemove', onMouseMove)
  document.body.removeEventListener('mouseup', onMouseUp)
})
</script>
