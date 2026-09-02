<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'

const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()

async function onLogout() {
  await auth.logout()
  router.push('/')
}
</script>

<template>
  <header class="site-header">
    <nav class="nav">
      <router-link to="/" class="logo">LGame<span>工作室</span></router-link>
      <div class="nav-links">
        <router-link to="/news">📰 新闻</router-link>
        <router-link to="/insight">🎮 心得</router-link>
        <router-link to="/learn">📚 学习</router-link>
        <router-link to="/daily">📝 日报</router-link>
        <router-link to="/timeline">🗓️ 时间线</router-link>
        <div class="nav-auth">
          <a href="#" class="theme-toggle" :title="theme.theme === 'dark' ? '切换到浅色' : '切换到深色'" @click.prevent="theme.toggle()">
            {{ theme.theme === 'dark' ? '☀️' : '🌙' }}
          </a>
          <template v-if="auth.isLoggedIn">
            <span class="nav-username">👋 {{ auth.user.username }}</span>
            <router-link v-if="auth.isAdmin" to="/admin">管理</router-link>
            <router-link v-if="auth.isAdmin" to="/report">周报</router-link>
            <a href="#" @click.prevent="onLogout">退出</a>
          </template>
          <template v-else>
            <router-link to="/login">登录</router-link>
            <router-link to="/register">
              <n-button size="small" type="primary">注册</n-button>
            </router-link>
          </template>
        </div>
      </div>
    </nav>
  </header>
</template>
