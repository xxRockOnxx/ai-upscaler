<template>
  <div>
    <div class="font-bold tracking-wider">
      {{ name }}
    </div>

    <progress
      class="w-full mt-2"
      max="100"
      :value="progress"
    />
  </div>
</template>

<script>
export default {
  props: {
    name: {
      type: String,
      required: true
    },

    progress: {
      type: Number,
      default: 0
    }
  }
}
</script>
