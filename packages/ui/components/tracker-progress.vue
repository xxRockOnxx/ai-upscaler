<template>
  <div>
    <div class="flex items-center justify-between">
      <div class="text-4xl">
        Progress
      </div>
    </div>

    <ProgressTask
      class="mt-8"
      name="Extracting frames"
      :progress="extract"
    />

    <ProgressTask
      class="mt-8"
      name="Enhancing frames"
      :progress="enhance"
    />

    <ProgressTask
      class="mt-8"
      name="Stitching frames"
      :progress="stitch"
    />

    <div class="mt-6">
      <ButtonCancel
        :disabled="status !== 'processing'"
        @click.native="$emit('cancel')"
      />

      <ButtonDownload
        class="ml-2"
        :disabled="status !== 'finished'"
      />
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

    extract: {
      type: Number,
      default: 0
    },

    enhance: {
      type: Number,
      default: 0
    },

    stitch: {
      type: Number,
      default: 0
    }
  }
}
</script>
