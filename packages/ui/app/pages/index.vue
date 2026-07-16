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
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-from-class="opacity-100"
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
            <template v-if="status !== 'processing'">
              <div class="px-4 pt-6 md:px-6">
                <ProcessorSelect
                  :model-value="processor"
                  :disabled="status === 'unavailable'"
                  @change="processor = $event"
                />

                <InterpolateCheckbox
                  :model-value="interpolate"
                  :disabled="status === 'unavailable'"
                  @change="interpolate = $event"
                />
              </div>

              <Uploader
                class="h-full"
                :class="{
                  'opacity-50': status === 'unavailable'
                }"
                :disabled="status === 'unavailable'"
                @change="onFileChange"
              />
            </template>

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
              :interpolate="progress.interpolate ?? null"
              :stitch="progress.stitch"
              @cancel="onCancel"
            />
          </div>
        </div>

        <TrackerQueue
          :status="status"
          :total="total"
          :position="position"
          :processed-on="processedOn"
        />
      </div>
    </div>

    <div ref="faqEl">
      <Faq />
    </div>

    <ScrollDown
      v-show="showScroll"
      class="fixed bottom-0 right-0 mb-6 mr-6"
      :top="scrollTop"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue'
import { createActor } from 'xstate'
import createQueueMachine from '../xstate/queue'

useHead({
  link: [
    {
      rel: 'preload',
      href: 'https://raw.githubusercontent.com/xinntao/public-figures/master/Real-ESRGAN/cmp_realesrgan_anime_1.png',
      as: 'image'
    }
  ]
})

const status = ref('unknown')
const error = ref(null)
const total = ref(null)
const position = ref(null)
const progress = ref({})
const processedOn = ref(null)
const frames = ref(0)

const processor = ref('real-esrgan')
const interpolate = ref(false)

const showScroll = ref(true)
const scrollTop = ref(0)

const faqEl = ref(null)

// The running XState actor — kept non-reactive (wrapping a live actor in deep
// reactivity is a Vue footgun).
const service = shallowRef(null)
let observer = null

/**
 * Flattens the machine's state value into a single status string for the
 * template, e.g. 'idle', 'waiting', or 'processing' (whose nested substates
 * — extracting/comparing — still surface as 'processing').
 */
function resolveStatus (value) {
  if (typeof value === 'string') {
    return value
  }

  const active = value.active
  return typeof active === 'string' ? active : Object.keys(active)[0]
}

/**
 * Hides the scroll down button when the user scrolls down to the FAQ.
 */
function startObserver () {
  observer = new window.IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      showScroll.value = false
      observer.disconnect()
    }
  }, {
    threshold: [0.2]
  })

  observer.observe(faqEl.value)
}

function startQueue () {
  const machine = createQueueMachine({
    getQueue: () => $fetch('/api/queue'),
    joinQueue: () => $fetch('/api/queue', { method: 'PUT', body: { forced: true } }),
    refreshQueue: () => $fetch('/api/queue', { method: 'PUT' }),
    getProgress: jobId => $fetch(`/api/jobs/${jobId}/progress`),
    getFrames: () => $fetch('/api/frames').then(({ frames: f }) => f),
    upload: ({ file, processor, interpolate: interpolateFrames }) => {
      const formData = new FormData()
      // Append `processor` and `interpolate` before `file` so the API can
      // read them as fields alongside the streamed file part.
      formData.append('processor', processor)
      formData.append('interpolate', interpolateFrames ? 'true' : 'false')
      formData.append('file', file)
      return $fetch('/api/submit', { method: 'POST', body: formData })
    },
    cancel: () => $fetch('/api/cancel', { method: 'PUT' })
  })

  const actor = createActor(machine)

  actor.subscribe((snapshot) => {
    status.value = resolveStatus(snapshot.value)
    error.value = snapshot.context.error
    total.value = snapshot.context.total
    position.value = snapshot.context.position
    progress.value = snapshot.context.progress
    processedOn.value = snapshot.context.processedOn
    frames.value = snapshot.context.frames
  })

  actor.start()
  service.value = actor
}

function onFileChange (file) {
  service.value.send({ type: 'UPLOAD', file, processor: processor.value, interpolate: interpolate.value })
}

function onCancel () {
  service.value.send({ type: 'CANCEL' })
}

onMounted(async () => {
  scrollTop.value = faqEl.value.offsetTop

  startObserver()

  try {
    const { available } = await $fetch('/api/availability')

    if (available) {
      startQueue()
    } else {
      status.value = 'unavailable'
      total.value = 0
    }
  } catch (e) {
    status.value = 'unavailable'
    total.value = 0
    throw e
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  service.value?.stop()
})
</script>
