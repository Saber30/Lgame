<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useThemeStore } from '../stores/theme'

const route = useRoute()
const theme = useThemeStore()

const TITLES = {
  '/': '工作台',
  '/news': '游戏新闻',
  '/insight': '游戏心得',
  '/learn': '学习园地',
  '/daily': '工作日报',
  '/timeline': '项目时间线',
  '/design': '策划案',
  '/report': '周报月报',
  '/admin': '管理后台',
  '/login': '登录',
  '/register': '注册',
}

const title = computed(() => {
  if (route.path.startsWith('/post/')) return '帖子详情'
  return TITLES[route.path] || 'LGame 工作室'
})
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <span class="topbar-title">{{ title }}</span>
    </div>
    <div class="topbar-right">
      <a
        href="#"
        class="topbar-btn"
        :title="theme.theme === 'dark' ? '切换到浅色' : '切换到深色'"
        @click.prevent="theme.toggle()"
      >
        {{ theme.theme === 'dark' ? '☀️' : '🌙' }}
      </a>
    </div>
  </header>
</template>
