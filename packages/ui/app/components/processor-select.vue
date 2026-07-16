<template>
  <label class="block">
    <span class="text-sm font-bold text-gray-600">
      Processor
    </span>

    <select
      class="w-full px-3 py-2 mt-1 bg-white border rounded focus:outline-none focus:ring focus:border-[#3C8CE7] disabled:opacity-50"
      :value="modelValue"
      :disabled="disabled"
      @change="onChange"
    >
      <option value="real-esrgan">
        Real-ESRGAN
      </option>
      <option value="waifu2x">
        waifu2x
      </option>
      <option value="anime4k">
        Anime4K
      </option>
    </select>
  </label>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'real-esrgan'
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
