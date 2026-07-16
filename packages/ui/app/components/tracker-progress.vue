<template>
  <div>
    <div class="flex items-center justify-between">
      <div class="text-2xl md:text-4xl">
        Progress
      </div>
    </div>

    <ProgressTask
      class="mt-4 md:mt-8"
      name="Extracting frames"
      :progress="extract"
    />

    <ProgressTask
      class="mt-4 md:mt-8"
      name="Enhancing frames"
      :progress="enhance"
    />

    <ProgressTask
      v-if="interpolate !== null"
      class="mt-4 md:mt-8"
      name="Interpolating frames"
      :progress="interpolate"
    />

    <ProgressTask
      class="mt-4 md:mt-8"
      name="Stitching frames"
      :progress="stitch"
    />

    <div class="flex mt-6">
      <ButtonCancel
        class="w-full sm:w-auto"
        :disabled="status !== 'processing'"
        @cancel="$emit('cancel')"
      />

      <ButtonDownload
        class="w-full ml-2 sm:w-auto"
        :disabled="status !== 'finished'"
      />
    </div>
  </div>
</template>

<script setup>
defineProps({
  status: {
    type: String,
    required: true
  },

  extract: {
    type: Number,
    default: 0
  },

  enhance: {
    type: Number,
    default: 0
  },

  // `null` hides the task — the worker only reports `interpolate`
  // progress when the job was submitted with interpolation enabled.
  interpolate: {
    type: Number,
    default: null
  },

  stitch: {
    type: Number,
    default: 0
  }
})

defineEmits(['cancel'])
</script>
