<template>
  <button
    type="button"
    class="p-3 text-white bg-[#085FC0] border-2 rounded-full shadow-2xl bounce"
    @click="scrollDown"
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
        d="M19 9l-7 7-7-7"
      />
    </svg>
  </button>
</template>

<script>
export default {
  props: {
    top: {
      type: Number,
      default: 0
    }
  },

  methods: {
    scrollDown () {
      window.scrollTo({
        top: this.top,
        behavior: 'smooth'
      })
    }
  }
}
</script>

<style scoped>
.bounce {
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    -webkit-transform: translateY(0);
    -ms-transform: translateY(0);
    transform: translateY(0);
  }

  33% {
    -webkit-transform: translateY(-21%);
    -ms-transform: translateY(-21%);
    transform: translateY(-21%);
  }

  66% {
    -webkit-transform: translateY(-13%);
    -ms-transform: translateY(-13%);
    transform: translateY(-13%);
  }
}
</style>
