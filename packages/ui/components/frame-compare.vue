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

<script>
export default {
  props: {
    total: {
      type: Number,
      default: 0
    }
  },

  data () {
    return {
      active: null,
      position: 50,
      tracking: false
    }
  },

  mounted () {
    document.body.addEventListener('mousemove', this.onMouseMove)
    document.body.addEventListener('mouseup', this.onMouseUp)
  },

  beforeDestroy () {
    document.body.removeEventListener('mousemove', this.onMouseMove)
    document.body.removeEventListener('mouseup', this.onMouseUp)
  },

  methods: {
    onMouseUp () {
      this.tracking = false
    },

    onMouseMove (evt) {
      if (!this.tracking) {
        return
      }

      const rect = this.$refs.canvas.getBoundingClientRect()
      const position = (evt.clientX - rect.left) / rect.width * 100

      this.position = Math.min(Math.max(position, 0), 100)
    }
  }
}
</script>
