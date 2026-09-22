<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import { categoryLabel, fmtTime, parseDailyMeta } from '../utils/format'
import { renderMarkdown } from '../utils/markdown'
import CommentSection from '../components/CommentSection.vue'
import FileUploadButton from '../components/FileUploadButton.vue'

const props = defineProps({ id: { type: [String, Number], required: true } })
const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()

const data = ref(null)
const loading = ref(true)
const error = ref('')

const liked = ref(false)
const likeCount = ref(0)
const editVisible = ref(false)
const editSubmitting = ref(false)
const editForm = reactive({ title: '', content: '', link: '', done: '', plan: '', issues: '' })

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
    liked.value = !!data.value.post.liked_by_me
    likeCount.value = data.value.post.like_count || 0
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function toggleLike() {
  if (!auth.isLoggedIn) return message.warning('请先登录')
  try {
    const res = await api.post(`/posts/${post.value.id}/like`)
    liked.value = res.liked
    likeCount.value = res.like_count
  } catch (e) {
    message.error(e.message)
  }
}

function openEdit() {
  const p = post.value
  if (p.category === 'daily') {
    const m = parseDailyMeta(p.meta)
    editForm.title = p.title
    editForm.done = m.done || ''
    editForm.plan = m.plan || ''
    editForm.issues = m.issues || ''
  } else {
    editForm.title = p.title
    editForm.content = p.content
    editForm.link = p.link || ''
  }
  editVisible.value = true
}

async function submitEdit() {
  editSubmitting.value = true
  try {
    const body =
      post.value.category === 'daily'
        ? { title: editForm.title, done: editForm.done, plan: editForm.plan, issues: editForm.issues }
        : { title: editForm.title, content: editForm.content, link: editForm.link || undefined }
    await api.patch(`/posts/${post.value.id}`, body)
    message.success('已保存')
    editVisible.value = false
    await load()
  } catch (e) {
    message.error(e.message)
  } finally {
    editSubmitting.value = false
  }
}

function onUploaded(data) {
  const md = data.type.startsWith('image/') ? `![](${data.url})` : `[${data.filename}](${data.url})`
  if (post.value.category === 'daily') {
    editForm.done = editForm.done ? editForm.done + '\n' + md : md
  } else {
    editForm.content = editForm.content ? editForm.content + '\n' + md : md
  }
}

async function onCommentAdded() {
  await load()
}

function onDelete() {
  dialog.warning({
    title: '提示',
    content: '确定删除这篇帖子吗？删除后无法恢复。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.del('/posts/' + post.value.id)
        message.success('已删除')
        router.push(categoryPath(post.value.category))
      } catch (e) {
        message.error(e.message)
      }
    },
  })
}

const previewFile = ref(null)
let clickTimer = null

const previewType = computed(() => {
  if (!previewFile.value) return 'none'
  const name = (previewFile.value.filename || '').toLowerCase()
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return 'image'
  if (/\.pdf$/.test(name)) return 'pdf'
  return 'other'
})

function isFileLink(target) {
  const a = target.closest('a')
  if (!a) return null
  const href = a.getAttribute('href')
  if (!href || !href.startsWith('/api/files/')) return null
  return { a, href }
}

function onContentClick(e) {
  const link = isFileLink(e.target)
  if (!link) return
  e.preventDefault()
  if (clickTimer) clearTimeout(clickTimer)
  const url = link.href
  const filename = link.a.textContent.trim()
  clickTimer = setTimeout(() => {
    previewFile.value = { url, filename }
    clickTimer = null
  }, 220)
}

function onContentDblClick(e) {
  const link = isFileLink(e.target)
  if (!link) return
  e.preventDefault()
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
  }
  const dl = document.createElement('a')
  dl.href = link.href + '?download=1'
  dl.download = link.a.textContent.trim()
  dl.click()
}

onMounted(load)
</script>

<template>
  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="empty">{{ error }}</div>

  <template v-else-if="post">
    <router-link :to="categoryPath(post.category)" class="back-link">← 返回列表</router-link>

    <article class="post-detail" @click="onContentClick" @dblclick="onContentDblClick">
      <div class="post-meta">
        <span class="badge" :class="'badge-' + post.category">{{ categoryLabel(post.category) }}</span>
        <span class="post-author">{{ post.author_name }}</span>
        <span class="post-time">{{ fmtTime(post.created_at) }}</span>
      </div>
      <h1>{{ post.title }}</h1>

      <template v-if="post.category === 'daily'">
        <div class="daily-block">
          <h4>✅ 今天完成</h4>
          <div v-if="meta.done" class="post-content" v-html="renderMarkdown(meta.done)"></div>
          <p v-else class="text-dim">（空）</p>
        </div>
        <div class="daily-block">
          <h4>📋 明日计划</h4>
          <div v-if="meta.plan" class="post-content" v-html="renderMarkdown(meta.plan)"></div>
          <p v-else class="text-dim">（空）</p>
        </div>
        <div class="daily-block">
          <h4>⚠️ 遇到的问题</h4>
          <div v-if="meta.issues" class="post-content" v-html="renderMarkdown(meta.issues)"></div>
          <p v-else class="text-dim">（无）</p>
        </div>
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
          <n-button>查看原文 ↗</n-button>
        </a>
      </template>

      <div class="post-actions">
        <n-button :type="liked ? 'primary' : 'default'" size="small" @click="toggleLike">
          {{ liked ? '已赞' : '点赞' }} <span v-if="likeCount">{{ likeCount }}</span>
        </n-button>
        <n-button v-if="data.canEdit" size="small" @click="openEdit">编辑</n-button>
        <n-button v-if="data.canDelete" size="small" type="error" secondary @click="onDelete">删除</n-button>
      </div>
    </article>

    <CommentSection :post-id="Number(post.id)" :comments="data.comments" @added="onCommentAdded" />

    <div v-if="previewFile" class="preview-panel">
      <div class="preview-panel-head">
        <span class="preview-panel-title">📄 {{ previewFile.filename }}</span>
        <n-button size="tiny" quaternary @click="previewFile = null">✕</n-button>
      </div>
      <div class="preview-panel-body">
        <img v-if="previewType === 'image'" :src="previewFile.url" alt="" />
        <iframe v-else-if="previewType === 'pdf'" :src="previewFile.url"></iframe>
        <div v-else class="preview-other">
          <p>{{ previewFile.filename }}</p>
          <p class="text-dim">该类型文件暂不支持在线预览</p>
          <a :href="previewFile.url + '?download=1'"><n-button size="small" type="primary">下载文件</n-button></a>
        </div>
      </div>
    </div>

    <n-modal v-model:show="editVisible" preset="card" title="编辑帖子" style="width: 600px">
      <n-form label-placement="top">
        <template v-if="post.category === 'daily'">
          <n-form-item label="标题">
            <n-input v-model:value="editForm.title" maxlength="100" placeholder="标题（可留空，自动按日期生成）" />
          </n-form-item>
          <n-form-item label="✅ 今天完成了什么">
            <n-input v-model:value="editForm.done" type="textarea" :rows="4" />
          </n-form-item>
          <n-form-item label="📋 明天计划做什么">
            <n-input v-model:value="editForm.plan" type="textarea" :rows="3" />
          </n-form-item>
          <n-form-item label="⚠️ 遇到的问题">
            <n-input v-model:value="editForm.issues" type="textarea" :rows="3" />
          </n-form-item>
        </template>
        <template v-else>
          <n-form-item label="标题">
            <n-input v-model:value="editForm.title" maxlength="100" />
          </n-form-item>
          <n-form-item v-if="post.category === 'news'" label="原文链接（可选）">
            <n-input v-model:value="editForm.link" placeholder="https://…" />
          </n-form-item>
          <n-form-item label="内容（支持 Markdown）">
            <n-input v-model:value="editForm.content" type="textarea" :rows="8" />
          </n-form-item>
        </template>
        <div style="margin-top: 4px">
          <FileUploadButton @uploaded="onUploaded" />
          <span class="text-dim" style="margin-left: 8px; font-size: 12px">图片自动预览，其他文件作为附件下载</span>
        </div>
      </n-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 10px">
          <n-button @click="editVisible = false">取消</n-button>
          <n-button type="primary" :loading="editSubmitting" @click="submitEdit">保存</n-button>
        </div>
      </template>
    </n-modal>
  </template>
</template>
