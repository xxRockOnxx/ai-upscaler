<template>
  <div
    class="w-full min-h-[340px] py-12 flex flex-col items-center justify-center cursor-pointer select-none transition-colors border-2 border-dashed"
    :class="disabled
      ? 'border-mist opacity-40 pointer-events-none'
      : 'border-mist hover:border-ink'"
    @dragover="onDragover"
    @drop="onDrop"
    @click="onClick"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="w-12 h-12 text-neutral-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>

    <div class="mt-6 text-xl font-semibold tracking-tight">
      Drop video here
    </div>

    <div class="mt-3 text-base text-neutral-500">
      or <span class="underline underline-offset-2">select file</span>
    </div>

    <div class="mt-6 text-sm text-neutral-500 uppercase tracking-wider">
      Up to 720p · 5 min max
    </div>

    <input
      ref="inputEl"
      type="file"
      accept="video/*"
      hidden
      :disabled="disabled"
      @change="onFileChange"
    >
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['change'])

const inputEl = ref(null)

function onClick () {
  inputEl.value.click()
}

function onFileChange (evt) {
  emit('change', evt.target.files[0])
  inputEl.value.value = null
}

function onDragover (evt) {
  evt.preventDefault()
}

function onDrop (evt) {
  evt.preventDefault()

  if (props.disabled) {
    return
  }

  if (evt.dataTransfer.files.length === 0) {
    return
  }

  let file

  for (let i = 0; i < evt.dataTransfer.files.length; i++) {
    if (evt.dataTransfer.files[i].type.startsWith('video')) {
      file = evt.dataTransfer.files[i]
      break
    }
  }

  if (!file) {
    return
  }

  emit('change', file)
}
</script>
