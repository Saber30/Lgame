<script setup>
import { onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  placeholder: { type: String, default: '搜索…' },
  delay: { type: Number, default: 350 },
})
const emit = defineEmits(['search'])

const text = ref('')
let timer = null

// 防抖：不要每敲一个字就打一次接口
watch(text, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => emit('search', value.trim()), props.delay)
})

onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div class="search-box">
    <n-input v-model:value="text" :placeholder="placeholder" clearable />
  </div>
</template>
