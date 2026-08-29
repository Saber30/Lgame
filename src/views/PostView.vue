<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api'
import { categoryLabel, fmtTime, parseDailyMeta } from '../utils/format'
import { renderMarkdown } from '../utils/markdown'
import CommentSection from '../components/CommentSection.vue'

const props = defineProps({ id: { type: [String, Number], required: true } })
const router = useRouter()

const data = ref(null)
const loading = ref(true)
const error = ref('')

const post = computed(() => data.value?.post)
const meta = computed(() => (post.value?.category === 'daily' ? parseDailyMeta(post.value.meta) : {}))

function categoryPath(cat) {
  return { news: '/news', insight: '/insight', learn: '/learn', daily: '/daily' }[cat] || '/'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await api.get('/posts/' + props.id)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function onCommentAdded() {
  await load()
}

async function onDelete() {
  try {
    await ElMessageBox.confirm('确定删除这篇帖子吗？删除后无法恢复。', '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await api.del('/posts/' + post.value.id)
    ElMessage.success('已删除')
    router.push(categoryPath(post.value.category))
  } catch (e) {
    ElMessage.error(e.message)
  }
}

onMounted(load)
</script>

<template>
  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="empty">{{ error }}</div>

  <template v-else-if="post">
    <router-link :to="categoryPath(post.category)" class="back-link">← 返回列表</router-link>

    <article class="post-detail">
      <div class="post-meta">
        <span class="badge" :class="'badge-' + post.category">{{ categoryLabel(post.category) }}</span>
        <span class="post-author">{{ post.author_name }}</span>
        <span class="post-time">{{ fmtTime(post.created_at) }}</span>
      </div>
      <h1>{{ post.title }}</h1>

      <template v-if="post.category === 'daily'">
        <div class="daily-block"><h4>✅ 今天完成</h4><p>{{ meta.done || '（空）' }}</p></div>
        <div class="daily-block"><h4>📋 明日计划</h4><p>{{ meta.plan || '（空）' }}</p></div>
        <div class="daily-block"><h4>⚠️ 遇到的问题</h4><p>{{ meta.issues || '（无）' }}</p></div>
        <div v-if="post.content" class="post-content" v-html="renderMarkdown(post.content)"></div>
      </template>
      <template v-else>
        <div class="post-content" v-html="renderMarkdown(post.content)"></div>
        <a
          v-if="post.link"
          class="source-btn"
          :href="post.link"
          target="_blank"
          rel="noopener"
        >
          <el-button>查看原文 ↗</el-button>
        </a>
      </template>

      <div v-if="data.canDelete" class="post-actions">
        <el-button type="danger" plain size="small" @click="onDelete">删除这篇帖子</el-button>
      </div>
    </article>

    <CommentSection :post-id="Number(post.id)" :comments="data.comments" @added="onCommentAdded" />
  </template>
</template>
