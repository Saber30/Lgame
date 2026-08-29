<script setup>
import { computed } from 'vue'

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, required: true },
  pageSize: { type: Number, default: 10 },
})
const emit = defineEmits(['change'])

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

<template>
  <div v-if="pages > 1" class="pagination">
    <button :disabled="page <= 1" @click="emit('change', page - 1)">上一页</button>
    <span>{{ page }} / {{ pages }}</span>
    <button :disabled="page >= pages" @click="emit('change', page + 1)">下一页</button>
  </div>
</template>
