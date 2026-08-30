<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import PostCard from '../components/PostCard.vue'
import PaginationBar from '../components/PaginationBar.vue'

const auth = useAuthStore()
const router = useRouter()
const message = useMessage()
const posts = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(true)
const error = ref('')
const PAGE_SIZE = 10

const form = reactive({ title: '', done: '', plan: '', issues: '' })
const submitting = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get(`/posts?category=daily&page=${page.value}&pageSize=${PAGE_SIZE}`)
    posts.value = data.posts
    total.value = data.total
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!form.done.trim() && !form.plan.trim() && !form.issues.trim()) {
    return message.warning('日报内容不能为空')
  }
  submitting.value = true
  try {
    const data = await api.post('/posts', {
      category: 'daily',
      title: form.title,
      done: form.done,
      plan: form.plan,
      issues: form.issues,
    })
    message.success('日报已提交 ✅')
    form.title = ''
    form.done = ''
    form.plan = ''
    form.issues = ''
    router.push('/post/' + data.id)
  } catch (e) {
    message.error(e.message)
  } finally {
    submitting.value = false
  }
}

function onPageChange(p) {
  page.value = p
  load()
  window.scrollTo(0, 0)
}

onMounted(load)
</script>

<template>
  <div class="page-head">
    <h1>📝 工作日报</h1>
    <p>今天做了什么、明天做什么、卡在了哪里</p>
  </div>

  <section v-if="auth.isLoggedIn" class="compose-card">
    <h2>📅 提交今日日报</h2>
    <n-form label-placement="top">
      <n-form-item label="标题">
        <n-input v-model:value="form.title" maxlength="100" placeholder="标题（可留空，自动按日期生成）" />
      </n-form-item>
      <n-form-item label="✅ 今天完成了什么">
        <n-input v-model:value="form.done" type="textarea" :rows="4" maxlength="10000" placeholder="今天做的工作、完成的任务、推进到哪一步了…" />
      </n-form-item>
      <n-form-item label="📋 明天计划做什么">
        <n-input v-model:value="form.plan" type="textarea" :rows="3" maxlength="10000" placeholder="明天的计划与安排…" />
      </n-form-item>
      <n-form-item label="⚠️ 遇到的问题（可选）">
        <n-input v-model:value="form.issues" type="textarea" :rows="3" maxlength="10000" placeholder="遇到的困难、需要谁协助、卡住的点…" />
      </n-form-item>
      <n-button type="primary" :loading="submitting" @click="submit">提交日报</n-button>
    </n-form>
  </section>
  <div v-else class="login-tip">👉 <router-link to="/login">登录</router-link> 后即可提交日报</div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="empty">加载失败：{{ error }}</div>
  <template v-else>
    <div class="post-list">
      <PostCard v-for="p in posts" :key="p.id" :post="p" />
      <div v-if="!posts.length" class="empty">还没有日报，提交今天的第一份吧</div>
    </div>
    <PaginationBar :page="page" :total="total" :page-size="PAGE_SIZE" @change="onPageChange" />
  </template>
</template>
