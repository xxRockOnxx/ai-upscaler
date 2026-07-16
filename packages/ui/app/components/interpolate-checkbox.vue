<template>
  <label class="flex items-center mt-3 cursor-pointer">
    <input
      type="checkbox"
      class="w-4 h-4 border rounded focus:outline-none focus:ring focus:border-[#3C8CE7] disabled:opacity-50"
      :checked="modelValue"
      :disabled="disabled"
      @change="onChange"
    >

    <span class="ml-2 text-sm font-bold text-gray-600">
      Interpolate frames (2x FPS)
    </span>
  </label>
</template>

<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['change'])

function onChange (evt) {
  emit('change', evt.target.checked)
}
</script>
