<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import PostCard from '../components/PostCard.vue'
import PostComposer from '../components/PostComposer.vue'
import PaginationBar from '../components/PaginationBar.vue'

const auth = useAuthStore()
const router = useRouter()
const posts = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(true)
const error = ref('')
const region = ref('all')
const PAGE_SIZE = 10

const TABS = [
  { value: 'all', label: '全部' },
  { value: 'domestic', label: '国内' },
  { value: 'overseas', label: '国外' },
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ category: 'news', page: String(page.value), pageSize: String(PAGE_SIZE) })
    if (region.value !== 'all') params.set('region', region.value)
    const data = await api.get('/posts?' + params.toString())
    posts.value = data.posts
    total.value = data.total
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function switchRegion(r) {
  region.value = r
  page.value = 1
  load()
}

function onCreated(id) {
  router.push('/post/' + id)
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
    <h1>📰 游戏新闻</h1>
    <p>自动聚合最新游戏资讯，支持国内 / 国外筛选</p>
  </div>

  <div class="region-tabs">
    <button
      v-for="t in TABS"
      :key="t.value"
      class="region-tab"
      :class="{ active: region === t.value }"
      @click="switchRegion(t.value)"
    >
      {{ t.label }}
    </button>
  </div>

  <PostComposer v-if="auth.isLoggedIn" category="news" @created="onCreated" />
  <div v-else class="login-tip">👉 <router-link to="/login">登录</router-link> 后即可发布新闻、参与讨论</div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="empty">加载失败：{{ error }}</div>
  <template v-else>
    <div class="post-list">
      <PostCard v-for="p in posts" :key="p.id" :post="p" />
      <div v-if="!posts.length" class="empty">还没有新闻，稍后再来看看</div>
    </div>
    <PaginationBar :page="page" :total="total" :page-size="PAGE_SIZE" @change="onPageChange" />
  </template>
</template>
