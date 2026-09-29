<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, required: true },
  pageSize: { type: Number, default: 10 },
})
const emit = defineEmits(['change'])

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const jump = ref(String(props.page))
// 回车提交后输入框会失焦、再提交一次，这里记住已提交的页码避免重复请求
let pending = null

watch(
  () => props.page,
  (p) => {
    pending = null
    jump.value = String(p)
  }
)

function go(value) {
  const n = Math.min(pages.value, Math.max(1, Math.floor(Number(value)) || 1))
  if (n === props.page || n === pending) {
    jump.value = String(n)
    return
  }
  pending = n
  emit('change', n)
}
</script>

<template>
  <div v-if="pages > 1" class="pagination">
    <button :disabled="page <= 1" @click="emit('change', 1)">« 首页</button>
    <button :disabled="page <= 1" @click="emit('change', page - 1)">上一页</button>
    <span class="pagination-jump">
      第
      <input
        v-model="jump"
        inputmode="numeric"
        @focus="$event.target.select()"
        @keyup.enter="go(jump)"
        @blur="go(jump)"
      />
      / {{ pages }} 页
    </span>
    <button :disabled="page >= pages" @click="emit('change', page + 1)">下一页</button>
    <button :disabled="page >= pages" @click="emit('change', pages)">末页 »</button>
    <span class="pagination-total">共 {{ total }} 条</span>
  </div>
</template>
