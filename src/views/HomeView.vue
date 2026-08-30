<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api'
import PostCard from '../components/PostCard.vue'

const posts = ref([])
const loading = ref(true)
const error = ref('')

const features = [
  { to: '/news', icon: '📰', title: '游戏新闻', desc: '分享值得一读的行业动态与新游资讯' },
  { to: '/insight', icon: '🎮', title: '游戏心得', desc: '记录玩过的好游戏、踩过的坑与感悟' },
  { to: '/learn', icon: '📚', title: '学习园地', desc: '学习笔记、教程与知识沉淀' },
  { to: '/daily', icon: '📝', title: '工作日报', desc: '今日完成、明日计划与遇到的问题' },
]

onMounted(async () => {
  try {
    const data = await api.get('/posts?pageSize=8')
    posts.value = data.posts
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="hero">
    <h1 class="hero-title">LGame <span>工作室</span></h1>
    <p class="hero-sub">独立游戏工作室的小站 -- 分享新闻、交流心得、记录学习与每一天</p>
    <div class="btn-row">
      <router-link to="/news">
        <n-button type="primary" size="large">看看最新消息</n-button>
      </router-link>
      <router-link to="/daily">
        <n-button size="large">今日日报</n-button>
      </router-link>
    </div>
  </section>

  <section class="features">
    <router-link v-for="f in features" :key="f.to" :to="f.to" class="feature-card">
      <div class="feature-icon">{{ f.icon }}</div>
      <h2>{{ f.title }}</h2>
      <p>{{ f.desc }}</p>
    </router-link>
  </section>

  <section>
    <h2 class="section-title">🔥 最新动态</h2>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="error" class="empty">加载失败：{{ error }}</div>
    <div v-else class="post-list">
      <PostCard v-for="p in posts" :key="p.id" :post="p" />
      <div v-if="!posts.length" class="empty">还没有内容，登录后发布第一条吧 ✨</div>
    </div>
  </section>
</template>
