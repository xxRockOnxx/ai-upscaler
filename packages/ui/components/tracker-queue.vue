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

<script>
export default {
  props: {
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
  },

  data () {
    return {
      elapsed: '00:00:00',
      elapsedInterval: null
    }
  },

  watch: {
    status (status) {
      if (status === 'processing') {
        this.startElapsed()
      } else {
        clearInterval(this.elapsedInterval)
        this.elapsed = '00:00:00'
      }
    }
  },

  methods: {
    startElapsed () {
      this.elapsedInterval = setInterval(() => {
        const elapsed = (Date.now() - this.processedOn) / 1000
        const seconds = Math.floor(elapsed % 60).toString().padStart(2, '0')
        const minutes = Math.floor(elapsed / 60 % 60).toString().padStart(2, '0')
        const hours = Math.floor(elapsed / 3600 % 24).toString().padStart(2, '0')
        this.elapsed = `${hours}:${minutes}:${seconds}`
      }, 1000)
    }
  }
}
</script>
