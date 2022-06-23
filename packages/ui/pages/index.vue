<template>
  <div>
    <Hero />

    <div class="container px-4 py-12 xl:py-28">
      <UnavailableCard
        v-if="status === 'unavailable'"
        class="mb-4"
      />

      <div class="border shadow">
        <div class="lg:flex">
          <div class="lg:w-1/2">
            <Uploader
              v-if="status !== 'processing'"
              class="h-full p-10 sm:p-16"
              :class="{
                'opacity-50': status === 'unavailable'
              }"
              :disabled="status === 'unavailable'"
              @change="onFileChange"
            />

            <FrameCompare
              v-else
              class="h-full"
              :frames="frames"
            />
          </div>

          <div class="lg:w-1/2">
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

    <Faq ref="faq" />

    <ScrollDown
      v-show="showScroll"
      class="fixed bottom-0 right-0 mb-6 mr-6"
      :top="scrollTop"
    />
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
      frames: [],

      showScroll: true,
      scrollTop: 0
    }
  },

  head: {
    link: [
      {
        rel: 'preload',
        href: 'https://raw.githubusercontent.com/xinntao/public-figures/master/Real-ESRGAN/cmp_realesrgan_anime_1.png',
        as: 'image'
      }
    ]
  },

  mounted () {
    this.scrollTop = this.$refs.faq.$el.offsetTop

    this.startObserver()

    const qm = createQueueMachine({
      getQueue: () => this.$axios.$get('/api/queue').catch((err) => {
        if (err && err.response && err.response.status === 503) {
          return {
            status: 'unavailable',
            position: null,
            total: 0
          }
        }

        throw err
      }),
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
    startObserver () {
      const observer = new window.IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          this.showScroll = false
          observer.disconnect()
        }
      }, {
        threshold: [0.2]
      })

      observer.observe(this.$refs.faq.$el)
    },

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
