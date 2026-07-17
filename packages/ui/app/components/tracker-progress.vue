<template>
  <div>
    <div class="text-xl font-semibold tracking-tight mb-8">
      Processing
    </div>

    <div class="space-y-8">
      <ProgressTask
        name="Extract frames"
        :progress="extract"
      />

      <ProgressTask
        name="Enhance frames"
        :progress="enhance"
      />

      <ProgressTask
        v-if="interpolate !== null"
        name="Interpolate frames"
        :progress="interpolate"
      />

      <ProgressTask
        name="Stitch frames"
        :progress="stitch"
      />
    </div>

    <div class="flex gap-4 mt-8">
      <ButtonCancel
        class="flex-1 sm:flex-none"
        :disabled="status !== 'processing'"
        @cancel="$emit('cancel')"
      />

      <ButtonDownload
        class="flex-1 sm:flex-none"
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
