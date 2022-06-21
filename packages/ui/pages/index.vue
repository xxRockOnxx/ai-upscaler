<template>
  <div>
    <Hero />

    <div class="container py-28">
      <div class="border shadow">
        <div class="md:flex">
          <div class="md:w-1/2">
            <Uploader
              v-if="status !== 'processing'"
              class="h-full p-10 sm:p-16"
              @change="onFileChange"
            />

            <FrameCompare
              v-else
              class="h-full"
              :frames="frames"
            />
          </div>

          <div class="md:w-1/2">
            <TrackerProgress
              class="px-6 py-12"
              :status="status"
              :extract="progress.extract"
              :enhance="progress.enhance"
              :stitch="progress.stitch"
              @cancel="onCancel"
            />
          </div>
        </div>

        <TrackerQueue
          :status="status"
          :total="total"
          :position="position"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { interpret } from 'xstate'
import createQueueMachine from '../xstate/queue'

export default {
  name: 'IndexPage',

  data () {
    return {
      qm: null,

      status: 'unknown',
      total: null,
      position: null,
      progress: {},
      frames: []
    }
  },

  mounted () {
    const qm = createQueueMachine({
      getQueue: () => this.$axios.$get('/api/queue'),
      joinQueue: () => this.$axios.$put('/api/queue', {
        forced: true
      }),
      refreshQueue: () => this.$axios.$put('/api/queue'),
      getProgress: () => this.$axios.$get('/api/progress'),
      getFrames: () => this.$axios.$get('/api/frames').then((frames) => {
        return frames.map((frame) => {
          return [`/api/frame/${frame}`, `/api/frame/${frame}?enhanced=true`]
        })
      }),
      upload: (file) => {
        const formData = new FormData()
        formData.append('file', file)
        return this.$axios.post('/api/submit', formData)
      },
      cancel: () => this.$axios.$put('/api/cancel')
    })

    this.qm = interpret(qm)
      .onTransition((state) => {
        this.status = typeof state.value === 'string' ? state.value : state.value.active
        this.total = state.context.total
        this.position = state.context.position
        this.progress = state.context.progress
        this.frames = state.context.frames
      })
      .start()
  },

  methods: {
    onFileChange (file) {
      this.qm.send({
        type: 'UPLOAD',
        file
      })
    },

    onCancel () {
      this.qm.send({
        type: 'CANCEL'
      })
    }
  }
}
</script>
