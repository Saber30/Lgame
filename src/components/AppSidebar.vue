<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const MENU = [
  { to: '/', label: '工作台', icon: '📊' },
  { to: '/news', label: '游戏新闻', icon: '📰' },
  { to: '/insight', label: '游戏心得', icon: '🎮' },
  { to: '/learn', label: '学习园地', icon: '📚' },
  { to: '/daily', label: '工作日报', icon: '📝' },
  { to: '/timeline', label: '项目时间线', icon: '🗓️' },
  { to: '/design', label: '策划案', icon: '📋' },
  { to: '/game', label: '小游戏', icon: '🎮' },
]

const ADMIN_MENU = [
  { to: '/report', label: '周报月报', icon: '🏆' },
  { to: '/admin', label: '管理后台', icon: '⚙️' },
]

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(path + '/')
}

async function onLogout() {
  await auth.logout()
  router.push('/')
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-logo">
      <router-link to="/">LGame<span>工作室</span></router-link>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-group">主菜单</div>
      <router-link
        v-for="m in MENU"
        :key="m.to"
        :to="m.to"
        class="sidebar-item"
        :class="{ active: isActive(m.to) }"
      >
        <span class="sidebar-icon">{{ m.icon }}</span>{{ m.label }}
      </router-link>
      <template v-if="auth.isAdmin">
        <div class="sidebar-group">管理</div>
        <router-link
          v-for="m in ADMIN_MENU"
          :key="m.to"
          :to="m.to"
          class="sidebar-item"
          :class="{ active: isActive(m.to) }"
        >
          <span class="sidebar-icon">{{ m.icon }}</span>{{ m.label }}
        </router-link>
      </template>
    </nav>
    <div class="sidebar-foot">
      <template v-if="auth.isLoggedIn">
        <div class="sidebar-user">
          <span class="sidebar-avatar">{{ auth.user.username.slice(0, 1) }}</span>
          <span class="sidebar-username">{{ auth.user.username }}</span>
        </div>
        <a href="#" class="sidebar-item" @click.prevent="onLogout"><span class="sidebar-icon">🚪</span>退出登录</a>
      </template>
      <template v-else>
        <router-link to="/login" class="sidebar-item"><span class="sidebar-icon">🔑</span>登录</router-link>
        <router-link to="/register" class="sidebar-item"><span class="sidebar-icon">✨</span>注册</router-link>
      </template>
    </div>
  </aside>
</template>
