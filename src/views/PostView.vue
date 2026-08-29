<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import { categoryLabel, fmtTime, parseDailyMeta } from '../utils/format'
import { renderMarkdown } from '../utils/markdown'
import CommentSection from '../components/CommentSection.vue'

const props = defineProps({ id: { type: [String, Number], required: true } })
const router = useRouter()
const auth = useAuthStore()

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
  if (!auth.isLoggedIn) return ElMessage.warning('请先登录')
  try {
    const res = await api.post(`/posts/${post.value.id}/like`)
    liked.value = res.liked
    likeCount.value = res.like_count
  } catch (e) {
    ElMessage.error(e.message)
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
    ElMessage.success('已保存')
    editVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    editSubmitting.value = false
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

      <div class="post-actions">
        <el-button :type="liked ? 'primary' : 'default'" size="small" @click="toggleLike">
          {{ liked ? '已赞' : '点赞' }} <span v-if="likeCount">{{ likeCount }}</span>
        </el-button>
        <el-button v-if="data.canEdit" size="small" @click="openEdit">编辑</el-button>
        <el-button v-if="data.canDelete" size="small" type="danger" plain @click="onDelete">删除</el-button>
      </div>
    </article>

    <CommentSection :post-id="Number(post.id)" :comments="data.comments" @added="onCommentAdded" />

    <el-dialog v-model="editVisible" title="编辑帖子" width="600px">
      <el-form label-position="top">
        <template v-if="post.category === 'daily'">
          <el-form-item label="标题">
            <el-input v-model="editForm.title" maxlength="100" placeholder="标题（可留空，自动按日期生成）" />
          </el-form-item>
          <el-form-item label="✅ 今天完成了什么">
            <el-input v-model="editForm.done" type="textarea" :rows="4" />
          </el-form-item>
          <el-form-item label="📋 明天计划做什么">
            <el-input v-model="editForm.plan" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item label="⚠️ 遇到的问题">
            <el-input v-model="editForm.issues" type="textarea" :rows="3" />
          </el-form-item>
        </template>
        <template v-else>
          <el-form-item label="标题">
            <el-input v-model="editForm.title" maxlength="100" />
          </el-form-item>
          <el-form-item v-if="post.category === 'news'" label="原文链接（可选）">
            <el-input v-model="editForm.link" placeholder="https://…" />
          </el-form-item>
          <el-form-item label="内容（支持 Markdown）">
            <el-input v-model="editForm.content" type="textarea" :rows="8" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </template>
</template>
