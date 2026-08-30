<script setup>
import { computed, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { api } from '../api'

const props = defineProps({
  category: { type: String, required: true },
})
const emit = defineEmits(['created'])

const message = useMessage()
const form = reactive({ title: '', content: '', link: '' })
const submitting = ref(false)

const isNews = computed(() => props.category === 'news')

const PLACEHOLDER = {
  news: {
    title: '新闻标题，例如：《XXX》正式公布发售日期',
    content: '用几句话介绍这条新闻讲了什么、为什么值得一看（支持 Markdown）',
  },
  insight: {
    title: '标题，例如：《XX》通关感想',
    content: '记录玩过的游戏、感想与评价（支持 Markdown）',
  },
  learn: {
    title: '标题，例如：Unity 中实现角色跳跃',
    content: '学习笔记、教程与知识沉淀（支持 Markdown）',
  },
}

async function submit() {
  if (!form.title.trim()) return message.warning('请填写标题')
  if (!form.content.trim()) return message.warning('请填写内容')
  submitting.value = true
  try {
    const data = await api.post('/posts', {
      category: props.category,
      title: form.title,
      content: form.content,
      link: form.link || undefined,
    })
    message.success('发布成功')
    emit('created', data.id)
    form.title = ''
    form.content = ''
    form.link = ''
  } catch (e) {
    message.error(e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="compose-card">
    <h2>{{ isNews ? '🗞️ 分享一条新闻' : '✍️ 发布新帖' }}</h2>
    <n-form label-placement="top">
      <n-form-item label="标题">
        <n-input v-model:value="form.title" maxlength="100" :placeholder="PLACEHOLDER[category].title" />
      </n-form-item>
      <n-form-item v-if="isNews" label="原文链接（建议填写）">
        <n-input v-model:value="form.link" placeholder="https://…" />
      </n-form-item>
      <n-form-item label="内容">
        <n-input
          v-model:value="form.content"
          type="textarea"
          :rows="5"
          maxlength="10000"
          show-count
          :placeholder="PLACEHOLDER[category].content"
        />
      </n-form-item>
      <n-button type="primary" :loading="submitting" @click="submit">发布</n-button>
    </n-form>
  </section>
</template>
