<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import { categoryEmoji, categoryLabel } from '../utils/format'
import PostCard from '../components/PostCard.vue'
import PostComposer from '../components/PostComposer.vue'
import PaginationBar from '../components/PaginationBar.vue'

const props = defineProps({ category: { type: String, required: true } })

const auth = useAuthStore()
const router = useRouter()
const posts = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(true)
const error = ref('')
const PAGE_SIZE = 10

const DESCR = {
  news: '分享值得一读的行业动态、新游资讯与公告',
  insight: '记录玩过的游戏、感想与评价',
  learn: '学习笔记、教程与知识沉淀',
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get(`/posts?category=${props.category}&page=${page.value}&pageSize=${PAGE_SIZE}`)
    posts.value = data.posts
    total.value = data.total
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
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
    <h1>{{ categoryEmoji(category) }} {{ categoryLabel(category) }}</h1>
    <p>{{ DESCR[category] }}</p>
  </div>

  <PostComposer v-if="auth.isLoggedIn" :category="category" @created="onCreated" />
  <div v-else class="login-tip">👉 <router-link to="/login">登录</router-link> 后即可发布内容、参与讨论</div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="empty">加载失败：{{ error }}</div>
  <template v-else>
    <div class="post-list">
      <PostCard v-for="p in posts" :key="p.id" :post="p" />
      <div v-if="!posts.length" class="empty">还没有内容，来发布第一条吧</div>
    </div>
    <PaginationBar :page="page" :total="total" :page-size="PAGE_SIZE" @change="onPageChange" />
  </template>
</template>
