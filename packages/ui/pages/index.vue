<template>
  <div>
    <Hero />

    <div class="container px-4 py-12 xl:py-28">
      <UnavailableCard
        v-if="status === 'unavailable'"
        class="mb-4"
      />

      <transition
        enter-active-class="duration-300 ease-in"
        leave-active-class="duration-300 ease-out"
        enter-class="opacity-0"
        enter-to-class="opacity-100"
        leave-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <Card
          v-if="status === 'processing'"
          type="info"
          class="mb-4"
        >
          Please do not leave this page while processing.
          After leaving for 1 minute, the process will be cancelled to conserve resources.
        </Card>

        <Card
          v-else-if="status === 'failed' || status === 'error'"
          type="error"
          class="mb-4"
        >
          <span class="whitespace-pre-line">{{ error }}</span>
        </Card>
      </transition>

      <div class="border shadow">
        <div class="lg:flex">
          <div class="lg:w-1/2">
            <Uploader
              v-if="status !== 'processing'"
              class="h-full"
              :class="{
                'opacity-50': status === 'unavailable'
              }"
              :disabled="status === 'unavailable'"
              @change="onFileChange"
            />

            <FrameCompare
              v-else
              class="h-full"
              :total="frames"
            />
          </div>

          <div class="lg:w-1/2">
            <TrackerProgress
              class="px-4 py-8 md:py-12 md:px-6"
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
      error: null,

      total: null,
      position: null,
      progress: {},
      frames: 0,

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

    this.$axios
      .$get('/api/availability')
      .then(({ available }) => {
        if (available) {
          this.startQueue()
        } else {
          this.status = 'unavailable'
          this.total = 0
        }
      })
      .catch((e) => {
        this.status = 'unavailable'
        this.total = 0
        throw e
      })
  },

  methods: {
    /**
     * Hides the scroll down button when the user scrolls down to the FAQ.
     */
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

    startQueue () {
      const qm = createQueueMachine({
        getQueue: () => this.$axios.$get('/api/queue'),
        joinQueue: () => this.$axios.$put('/api/queue', {
          forced: true
        }),
        refreshQueue: () => this.$axios.$put('/api/queue'),
        getProgress: jobId => this.$axios.$get(`/api/jobs/${jobId}/progress`),
        getFrames: () => this.$axios.$get('/api/frames').then(({ frames }) => frames),
        upload: (file) => {
          const formData = new FormData()
          formData.append('file', file)
          return this.$axios.$post('/api/submit', formData)
        },
        cancel: () => this.$axios.$put('/api/cancel')
      })

      this.qm = interpret(qm)
        .onTransition((state) => {
          this.status = typeof state.value === 'string' ? state.value : state.value.active
          this.error = state.context.error
          this.total = state.context.total
          this.position = state.context.position
          this.progress = state.context.progress
          this.frames = state.context.frames
        })
        .start()
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
