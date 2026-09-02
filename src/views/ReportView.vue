<script setup>
import { computed, onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { api } from '../api'
import { fmtDate, parseDailyMeta } from '../utils/format'
import { renderMarkdown } from '../utils/markdown'

const message = useMessage()
const days = ref(7)
const data = ref(null)
const loading = ref(true)
const error = ref('')

const periodLabel = computed(() => (days.value === 7 ? '周报' : '月报'))

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await api.get('/reports?days=' + days.value)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function switchPeriod(d) {
  days.value = d
  load()
}

function buildText() {
  const lines = [`# LGame ${periodLabel.value}汇总（近 ${days.value} 天）`, '']
  for (const r of data.value.reports) {
    lines.push(`## ${r.username}（${r.posts.length} 篇）`)
    for (const p of r.posts) {
      const m = parseDailyMeta(p.meta)
      lines.push(`### ${fmtDate(p.created_at)}`)
      if (m.done) lines.push(`- 完成：${m.done}`)
      if (m.plan) lines.push(`- 计划：${m.plan}`)
      if (m.issues) lines.push(`- 问题：${m.issues}`)
      lines.push('')
    }
  }
  return lines.join('\n')
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(buildText())
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败，请手动全选复制')
  }
}

onMounted(load)
</script>

<template>
  <div class="page-head">
    <h1>📊 周报 / 月报</h1>
    <p>汇总成员日报，方便考核</p>
  </div>

  <div class="region-tabs">
    <button class="region-tab" :class="{ active: days === 7 }" @click="switchPeriod(7)">周报（近 7 天）</button>
    <button class="region-tab" :class="{ active: days === 30 }" @click="switchPeriod(30)">月报（近 30 天）</button>
    <n-button type="primary" style="margin-left: auto" @click="copyReport">📋 复制汇总</n-button>
  </div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="empty">加载失败：{{ error }}</div>
  <template v-else-if="data">
    <div v-if="!data.reports.length" class="empty">近 {{ days }} 天还没有人提交日报</div>

    <div v-for="r in data.reports" :key="r.user_id" class="report-member">
      <h2 class="report-name">{{ r.username }} <span class="text-dim">（{{ r.posts.length }} 篇）</span></h2>
      <div v-for="p in r.posts" :key="p.id" class="report-post">
        <div class="report-post-head"><strong>{{ fmtDate(p.created_at) }}</strong></div>
        <div class="daily-block">
          <h4>✅ 完成</h4>
          <div v-if="parseDailyMeta(p.meta).done" class="post-content" v-html="renderMarkdown(parseDailyMeta(p.meta).done)"></div>
          <p v-else class="text-dim">（空）</p>
        </div>
        <div class="daily-block">
          <h4>📋 计划</h4>
          <div v-if="parseDailyMeta(p.meta).plan" class="post-content" v-html="renderMarkdown(parseDailyMeta(p.meta).plan)"></div>
          <p v-else class="text-dim">（空）</p>
        </div>
        <div class="daily-block">
          <h4>⚠️ 问题</h4>
          <div v-if="parseDailyMeta(p.meta).issues" class="post-content" v-html="renderMarkdown(parseDailyMeta(p.meta).issues)"></div>
          <p v-else class="text-dim">（无）</p>
        </div>
      </div>
    </div>
  </template>
</template>
