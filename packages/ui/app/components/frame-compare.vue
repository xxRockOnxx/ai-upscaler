<template>
  <div>
    <div class="h-24 overflow-x-auto">
      <div class="flex h-full gap-4 flex-nowrap">
        <button
          v-for="(frame) in total"
          :key="frame"
          type="button"
          class="h-full aspect-video"
          @click="active = frame"
        >
          <img
            :src="`/api/frames/${frame}`"
            :alt="`Frame #${frame}`"
          >
        </button>
      </div>
    </div>

    <div
      ref="canvas"
      class="relative w-full border-t aspect-video"
    >
      <template
        v-if="active !== null"
      >
        <img
          :src="`/api/frames/${active}`"
          class="absolute inset-0 object-contain w-full h-full bg-white pointer-events-none"
          alt="Old frame"
        >

        <img
          :src="`/api/frames/${active}?enhanced=true`"
          :style="{
            clipPath: `polygon(${position}% 0, 100% 0, 100% 100%, ${position}% 100%)`
          }"
          class="absolute inset-0 object-contain w-full h-full bg-white pointer-events-none"
          alt="New frame"
        >

        <div
          class="absolute h-full"
          :style="{
            left: `${position}%`
          }"
        >
          <div class="w-px h-full bg-white mix-blend-difference" />
          <button
            type="button"
            class="absolute w-4 h-4 bg-white border rounded-full shadow-xl"
            :style="{
              top: 'calc(50% - 0.5rem)',
              left: `-0.5rem`
            }"
            @mousedown="tracking = true"
          />
        </div>
      </template>

      <div
        v-else
        class="flex items-center justify-center h-full"
      >
        <span v-if="total === 0">No frames available</span>
        <span v-else-if="active === null">Select a frame to compare</span>
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
