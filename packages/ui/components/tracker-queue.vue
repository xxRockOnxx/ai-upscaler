<template>
  <div
    class="p-4 space-y-2 text-sm md:p-6 md:text-base"
    :class="{
      'bg-gray-50': status !== 'failed',
      'bg-red-50 text-red-500': ['failed', 'error'].includes(status),
    }"
  >
    <div>
      Status: {{ status }}
    </div>

    <div>
      People waiting: {{ total }}
    </div>

    <div v-if="position">
      Your position: {{ position }}
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

    total: {
      type: Number,
      default: 0
    },

    position: {
      type: Number,
      default: null
    }
  }
}
</script>
