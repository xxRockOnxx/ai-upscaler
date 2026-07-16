<template>
  <label class="block mt-3">
    <span class="text-sm font-bold text-gray-600">
      Frame interpolation (2x FPS)
    </span>

    <select
      class="w-full px-3 py-2 mt-1 bg-white border rounded focus:outline-none focus:ring focus:border-[#3C8CE7] disabled:opacity-50"
      :value="modelValue"
      :disabled="disabled"
      @change="onChange"
    >
      <option value="none">
        None
      </option>
      <option value="rife">
        RIFE
      </option>
      <option value="cain">
        CAIN
      </option>
    </select>
  </label>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'none'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['change'])

function onChange (evt) {
  emit('change', evt.target.value)
}
</script>
