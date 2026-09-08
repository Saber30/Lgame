<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import { renderMarkdown } from '../utils/markdown'

const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const projects = ref([])
const milestones = ref([])
const users = ref([])
const loading = ref(true)
const error = ref('')

const showProject = ref(false)
const projSubmitting = ref(false)
const projForm = reactive({ title: '', start_date: '', end_date: '', description: '' })

const showPhase = ref(false)
const phaseSubmitting = ref(false)
const phaseForm = reactive({ project_id: null, title: '', start_date: '', due_date: '', assignee_id: null, description: '' })

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
}

function statusOfPhase(m) {
  if (m.status === 'done') return { label: '已完成', cls: 'tl-done' }
  const t = todayStr()
  if (m.due_date < t) return { label: '已逾期', cls: 'tl-overdue' }
  if (m.due_date === t) return { label: '今天截止', cls: 'tl-today' }
  return { label: '进行中', cls: 'tl-pending' }
}

function milestonesOf(projectId) {
  return milestones.value.filter((m) => m.project_id === projectId)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [pd, md] = await Promise.all([api.get('/projects'), api.get('/milestones')])
    projects.value = pd.projects
    milestones.value = md.milestones
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadUsers() {
  try {
    const ud = await api.get('/users')
    users.value = ud.users
  } catch {}
}

function openAddProject() {
  projForm.title = ''
  projForm.start_date = ''
  projForm.end_date = ''
  projForm.description = ''
  showProject.value = true
}

async function submitAddProject() {
  if (!projForm.title.trim()) return message.warning('请输入项目名称')
  projSubmitting.value = true
  try {
    await api.post('/projects', { ...projForm })
    message.success('项目已创建')
    showProject.value = false
    load()
  } catch (e) {
    message.error(e.message)
  } finally {
    projSubmitting.value = false
  }
}

function openAddPhase(projectId) {
  loadUsers()
  phaseForm.project_id = projectId
  phaseForm.title = ''
  phaseForm.start_date = ''
  phaseForm.due_date = ''
  phaseForm.assignee_id = null
  phaseForm.description = ''
  showPhase.value = true
}

async function submitAddPhase() {
  if (!phaseForm.title.trim()) return message.warning('请输入阶段标题')
  if (!phaseForm.due_date) return message.warning('请选择截止日期')
  phaseSubmitting.value = true
  try {
    await api.post('/milestones', { ...phaseForm })
    message.success('阶段已添加')
    showPhase.value = false
    load()
  } catch (e) {
    message.error(e.message)
  } finally {
    phaseSubmitting.value = false
  }
}

function toggleProject(p) {
  const toDone = p.status !== 'done'
  dialog.warning({
    title: '提示',
    content: toDone ? `确定将项目「${p.title}」标记为完成吗？` : `确定将项目「${p.title}」标记为进行中吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.patch('/projects/' + p.id, { status: toDone ? 'done' : 'active' })
        load()
      } catch (e) {
        message.error(e.message)
      }
    },
  })
}

function removeProject(p) {
  dialog.warning({
    title: '删除',
    content: `确定删除项目「${p.title}」吗？该项目下所有阶段也会一起删除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.del('/projects/' + p.id)
        message.success('已删除')
        load()
      } catch (e) {
        message.error(e.message)
      }
    },
  })
}

function togglePhase(m) {
  const toDone = m.status !== 'done'
  dialog.warning({
    title: '提示',
    content: toDone ? `确定将「${m.title}」标记为完成吗？` : `确定将「${m.title}」标记为未完成吗？`,
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

function removePhase(m) {
  dialog.warning({
    title: '删除',
    content: `确定删除阶段「${m.title}」吗？`,
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
    <h1>🗓️ 项目时间线</h1>
    <p>一个长期项目，一条时间线，每个阶段记录什么时间完成什么</p>
  </div>

  <div v-if="auth.isAdmin" style="margin-bottom: 18px">
    <n-button type="primary" @click="openAddProject">+ 新建项目</n-button>
  </div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="empty">加载失败：{{ error }}</div>
  <div v-else>
    <div v-if="!projects.length" class="empty">还没有项目，管理员创建一个吧</div>

    <div v-for="p in projects" :key="p.id" class="project-card" :class="{ 'project-done': p.status === 'done' }">
      <div class="project-head">
        <div class="project-title-row">
          <h2 class="project-title">{{ p.title }}</h2>
          <span class="tl-badge" :class="p.status === 'done' ? 'tl-done' : 'tl-pending'">
            {{ p.status === 'done' ? '已完成' : '进行中' }}
          </span>
        </div>
        <div class="project-meta">
          <span v-if="p.start_date || p.end_date" class="text-dim">
            {{ p.start_date || '?' }} ~ {{ p.end_date || '?' }}
          </span>
          <span class="text-dim">完成 {{ p.done_phases }}/{{ p.total_phases }} 阶段</span>
        </div>
        <div v-if="p.total_phases" class="progress-bar">
          <div class="progress-fill" :style="{ width: Math.round((p.done_phases / p.total_phases) * 100) + '%' }"></div>
        </div>
        <div v-if="p.description" class="post-content" v-html="renderMarkdown(p.description)"></div>
        <div class="project-actions">
          <n-button v-if="auth.isAdmin" size="small" @click="openAddPhase(p.id)">+ 添加阶段</n-button>
          <n-button size="small" @click="toggleProject(p)">
            {{ p.status === 'done' ? '↩ 标记进行中' : '✓ 标记项目完成' }}
          </n-button>
          <n-button v-if="auth.isAdmin" size="small" type="error" secondary @click="removeProject(p)">删除项目</n-button>
        </div>
      </div>

      <div class="timeline">
        <div v-if="!milestonesOf(p.id).length" class="text-dim" style="padding: 8px 0 0 22px">还没有阶段，点「添加阶段」开始规划</div>
        <div v-for="m in milestonesOf(p.id)" :key="m.id" class="timeline-item">
          <div class="timeline-dot" :class="statusOfPhase(m).cls"></div>
          <div class="timeline-card" :class="{ 'tl-card-done': m.status === 'done' }">
            <div class="timeline-head">
              <span class="timeline-date">{{ m.start_date || m.due_date }}</span>
              <span v-if="m.start_date && m.start_date !== m.due_date" class="text-dim">→ {{ m.due_date }}</span>
              <span class="tl-badge" :class="statusOfPhase(m).cls">{{ statusOfPhase(m).label }}</span>
              <span v-if="m.assignee_name" class="text-dim">👤 {{ m.assignee_name }}</span>
            </div>
            <h3 class="timeline-title">{{ m.title }}</h3>
            <div v-if="m.description" class="post-content" v-html="renderMarkdown(m.description)"></div>
            <div class="timeline-actions">
              <n-button size="small" @click="togglePhase(m)">
                {{ m.status === 'done' ? '↩ 标记未完成' : '✓ 标记完成' }}
              </n-button>
              <n-button v-if="auth.isAdmin" size="small" type="error" secondary @click="removePhase(m)">删除</n-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <n-modal v-model:show="showProject" preset="card" title="新建项目" style="width: 520px">
    <n-form label-placement="top">
      <n-form-item label="项目名称">
        <n-input v-model:value="projForm.title" maxlength="100" placeholder="例如：开发《XX》游戏" />
      </n-form-item>
      <div style="display: flex; gap: 12px">
        <n-form-item label="开始日期" style="flex: 1">
          <input v-model="projForm.start_date" type="date" class="native-date-input" />
        </n-form-item>
        <n-form-item label="结束日期" style="flex: 1">
          <input v-model="projForm.end_date" type="date" class="native-date-input" />
        </n-form-item>
      </div>
      <n-form-item label="项目说明（可选，支持 Markdown）">
        <n-input v-model:value="projForm.description" type="textarea" :rows="3" placeholder="项目目标、范围等…" />
      </n-form-item>
    </n-form>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 10px">
        <n-button @click="showProject = false">取消</n-button>
        <n-button type="primary" :loading="projSubmitting" @click="submitAddProject">创建</n-button>
      </div>
    </template>
  </n-modal>

  <n-modal v-model:show="showPhase" preset="card" title="添加阶段" style="width: 520px">
    <n-form label-placement="top">
      <n-form-item label="这个阶段要完成什么（标题）">
        <n-input v-model:value="phaseForm.title" maxlength="100" placeholder="例如：完成战斗系统原型" />
      </n-form-item>
      <div style="display: flex; gap: 12px">
        <n-form-item label="开始日期" style="flex: 1">
          <input v-model="phaseForm.start_date" type="date" class="native-date-input" />
        </n-form-item>
        <n-form-item label="截止日期" style="flex: 1">
          <input v-model="phaseForm.due_date" type="date" class="native-date-input" />
        </n-form-item>
      </div>
      <n-form-item label="负责人（可选）">
        <n-select
          v-model:value="phaseForm.assignee_id"
          clearable
          :options="users.map((u) => ({ label: u.username, value: u.id }))"
          placeholder="选择负责人"
        />
      </n-form-item>
      <n-form-item label="完成内容说明（可选，支持 Markdown）">
        <n-input v-model:value="phaseForm.description" type="textarea" :rows="3" placeholder="这个阶段具体完成什么…" />
      </n-form-item>
    </n-form>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 10px">
        <n-button @click="showPhase = false">取消</n-button>
        <n-button type="primary" :loading="phaseSubmitting" @click="submitAddPhase">添加</n-button>
      </div>
    </template>
  </n-modal>
</template>