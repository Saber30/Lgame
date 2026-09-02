<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import { renderMarkdown } from '../utils/markdown'

const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const milestones = ref([])
const users = ref([])
const loading = ref(true)
const error = ref('')

const showAdd = ref(false)
const submitting = ref(false)
const form = reactive({ title: '', due_date: '', assignee_id: null, description: '' })

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
}

function statusOf(m) {
  if (m.status === 'done') return { label: '已完成', cls: 'tl-done' }
  const t = todayStr()
  if (m.due_date < t) return { label: '已逾期', cls: 'tl-overdue' }
  if (m.due_date === t) return { label: '今天截止', cls: 'tl-today' }
  return { label: '进行中', cls: 'tl-pending' }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get('/milestones')
    milestones.value = data.milestones
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function openAdd() {
  if (!auth.isAdmin) return
  try {
    const ud = await api.get('/users')
    users.value = ud.users
  } catch {}
  form.title = ''
  form.due_date = ''
  form.assignee_id = null
  form.description = ''
  showAdd.value = true
}

async function submitAdd() {
  if (!form.title.trim()) return message.warning('请填写标题')
  if (!form.due_date) return message.warning('请选择截止日期')
  submitting.value = true
  try {
    await api.post('/milestones', {
      title: form.title,
      due_date: form.due_date,
      assignee_id: form.assignee_id,
      description: form.description,
    })
    message.success('已添加')
    showAdd.value = false
    load()
  } catch (e) {
    message.error(e.message)
  } finally {
    submitting.value = false
  }
}

function toggleDone(m) {
  const toDone = m.status !== 'done'
  dialog.warning({
    title: '提示',
    content: toDone ? `确定将「${m.title}」标记为已完成吗？` : `确定将「${m.title}」标记为未完成吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.patch('/milestones/' + m.id, { status: toDone ? 'done' : 'pending' })
        load()
      } catch (e) {
        message.error(e.message)
      }
    },
  })
}

function remove(m) {
  dialog.warning({
    title: '删除',
    content: `确定删除里程碑「${m.title}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.del('/milestones/' + m.id)
        message.success('已删除')
        load()
      } catch (e) {
        message.error(e.message)
      }
    },
  })
}

onMounted(load)
</script>

<template>
  <div class="page-head">
    <h1>🗓️ 时间线</h1>
    <p>明确什么时间点该完成什么</p>
  </div>

  <div v-if="auth.isAdmin" style="margin-bottom: 18px">
    <n-button type="primary" @click="openAdd">+ 添加里程碑</n-button>
  </div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="empty">加载失败：{{ error }}</div>
  <div v-else class="timeline">
    <div v-if="!milestones.length" class="empty">还没有里程碑，管理员添加一个吧</div>
    <div v-for="m in milestones" :key="m.id" class="timeline-item">
      <div class="timeline-dot" :class="statusOf(m).cls"></div>
      <div class="timeline-card" :class="{ 'tl-card-done': m.status === 'done' }">
        <div class="timeline-head">
          <span class="timeline-date">{{ m.due_date }}</span>
          <span class="tl-badge" :class="statusOf(m).cls">{{ statusOf(m).label }}</span>
          <span v-if="m.assignee_name" class="text-dim">👤 {{ m.assignee_name }}</span>
        </div>
        <h3 class="timeline-title">{{ m.title }}</h3>
        <div v-if="m.description" class="post-content" v-html="renderMarkdown(m.description)"></div>
        <div class="timeline-actions">
          <n-button size="small" @click="toggleDone(m)">
            {{ m.status === 'done' ? '↩ 标记未完成' : '✓ 标记完成' }}
          </n-button>
          <n-button v-if="auth.isAdmin" size="small" type="error" secondary @click="remove(m)">删除</n-button>
        </div>
      </div>
    </div>
  </div>

  <n-modal v-model:show="showAdd" preset="card" title="添加里程碑" style="width: 520px">
    <n-form label-placement="top">
      <n-form-item label="要完成什么（标题）">
        <n-input v-model:value="form.title" maxlength="100" placeholder="例如：完成战斗系统原型" />
      </n-form-item>
      <n-form-item label="截止日期">
        <n-date-picker v-model:formatted-value="form.due_date" type="date" value-format="yyyy-MM-dd" style="width: 100%" />
      </n-form-item>
      <n-form-item label="负责人（可选）">
        <n-select
          v-model:value="form.assignee_id"
          clearable
          :options="users.map((u) => ({ label: u.username, value: u.id }))"
          placeholder="选择负责人"
        />
      </n-form-item>
      <n-form-item label="详细说明（可选，支持 Markdown）">
        <n-input v-model:value="form.description" type="textarea" :rows="3" placeholder="补充说明…" />
      </n-form-item>
    </n-form>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 10px">
        <n-button @click="showAdd = false">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="submitAdd">添加</n-button>
      </div>
    </template>
  </n-modal>
</template>
