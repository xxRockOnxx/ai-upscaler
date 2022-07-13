<template>
  <div
    @dragover="onDragover"
    @drop="onDrop"
  >
    <button
      class="w-full h-full p-10 sm:p-16"
      type="button"
      :disabled="disabled"
      @click="onClick"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-10 h-10 mx-auto text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>

      <div class="mt-6 text-xl text-center md:text-2xl">
        Drop a video to upload
      </div>

      <div class="mt-6 text-center">
        <div
          class="inline-flex items-center px-4 py-2 text-white font-bold bg-[#3C8CE7] rounded"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <div class="ml-2 text-sm md:text-base">
            Select Video
          </div>
        </div>
      </div>
    </button>

    <input
      ref="input"
      type="file"
      accept="video/*"
      hidden
      :disabled="disabled"
      @change="onFileChange"
    >
  </div>
</template>

<script>
export default {
  props: {
    disabled: {
      type: Boolean,
      default: false
    }
  },

  methods: {
    onClick () {
      this.$refs.input.click()
    },

    onFileChange (evt) {
      this.$emit('change', evt.target.files[0])
      this.$refs.input.value = null
    },

    onDragover (evt) {
      evt.preventDefault()
    },

    onDrop (evt) {
      evt.preventDefault()

      if (this.disabled) {
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

      this.$emit('change', file)
    }
  }
}
</script>
