<template>
  <div>
    <Hero />

    <div class="container py-28">
      <div class="border shadow">
        <div class="flex">
          <div class="w-1/2">
            <Uploader
              class="h-full"
              @change="onFileChange"
            />
          </div>

          <div class="w-1/2">
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
          class="p-6 bg-gray-50"
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
      progress: {}
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
