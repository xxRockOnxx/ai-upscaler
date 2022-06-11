<template>
  <div class="space-y-2">
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
