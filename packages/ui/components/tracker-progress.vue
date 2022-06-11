<template>
  <div>
    <div class="text-4xl">
      Progress
    </div>

    <ProgressTask
      class="mt-6"
      name="Extracting frames"
      :progress="extract"
    />

    <ProgressTask
      class="mt-6"
      name="Enhancing frames"
      :progress="enhance"
    />

    <ProgressTask
      class="mt-6"
      name="Stitching frames"
      :progress="stitch"
    />

    <button
      v-show="status === 'processing'"
      class="mt-6 font-bold tracking-wider text-blue-500"
      @click="$emit('cancel')"
    >
      Click here to cancel
    </button>
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
