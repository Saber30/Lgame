<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import { beijingDayKey, fmtDayLabel, todayBeijing } from '../utils/format'
import PostCard from '../components/PostCard.vue'
import PaginationBar from '../components/PaginationBar.vue'
import FileUploadButton from '../components/FileUploadButton.vue'
import SearchInput from '../components/SearchInput.vue'

const auth = useAuthStore()
const router = useRouter()
const message = useMessage()
const posts = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(true)
const error = ref('')
const PAGE_SIZE = 10
const checkin = ref(null)
const members = ref([])

// 筛选条件
const keyword = ref('')
const authorId = ref(null)
const day = ref('')

// 本月提交总览
const today = todayBeijing()
const overviewMonth = ref(today.slice(0, 7))
const overview = ref({ members: [], entries: [] })

const form = reactive({ title: '', day: today, done: '', plan: '', issues: '', cover: '' })
const submitting = ref(false)

const hasFilter = computed(() => !!keyword.value || !!authorId.value || !!day.value)
const memberOptions = computed(() => members.value.map((m) => ({ label: m.username, value: m.id })))
const isThisMonth = computed(() => overviewMonth.value >= today.slice(0, 7))

/** 总览表格：成员 × 当月每一天 */
const overviewGrid = computed(() => {
  const [y, m] = overviewMonth.value.split('-').map(Number)
  if (!y || !m) return { days: [], rows: [] }
  const dayCount = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const done = new Set(overview.value.entries.map((e) => `${e.user_id}:${e.day}`))
  const days = Array.from({ length: dayCount }, (_, i) => {
    const d = i + 1
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    return { d, key, weekend: dow === 0 || dow === 6, future: key > today, isToday: key === today }
  })
  const rows = overview.value.members.map((mem) => {
    const cells = days.map((d) => done.has(`${mem.id}:${d.key}`))
    return { id: mem.id, name: mem.username, cells, count: cells.filter(Boolean).length }
  })
  return { days, rows }
})

/** 我今天交了没（打卡接口只统计今天） */
const myToday = computed(() => {
  const uid = auth.user?.id
  if (!uid || !checkin.value) return null
  return checkin.value.done.some((d) => d.id === uid)
})

/** 按天分组，方便按日期回看 */
const grouped = computed(() => {
  const out = []
  for (const p of posts.value) {
    const key = beijingDayKey(p.created_at)
    const last = out[out.length - 1]
    if (last && last.key === key) last.items.push(p)
    else out.push({ key, items: [p] })
  }
  return out
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ category: 'daily', page: String(page.value), pageSize: String(PAGE_SIZE) })
    if (keyword.value) params.set('q', keyword.value)
    if (authorId.value) params.set('author', String(authorId.value))
    if (day.value) params.set('date', day.value)
    const data = await api.get('/posts?' + params.toString())
    posts.value = data.posts
    total.value = data.total
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadCheckin() {
  if (!auth.isLoggedIn) return
  try {
    checkin.value = await api.get('/daily-checkin')
  } catch {
    checkin.value = null
  }
}

async function loadMembers() {
  if (!auth.isLoggedIn) return
  try {
    const data = await api.get('/members')
    members.value = data.members || []
  } catch {
    members.value = []
  }
}

async function loadOverview() {
  if (!auth.isLoggedIn) return
  try {
    overview.value = await api.get('/daily-overview?month=' + overviewMonth.value)
  } catch {
    overview.value = { members: [], entries: [] }
  }
}

function shiftMonth(step) {
  const [y, m] = overviewMonth.value.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + step, 1))
  overviewMonth.value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  loadOverview()
}

/** 改了筛选条件就回到第 1 页重新查 */
function applyFilter() {
  page.value = 1
  load()
  window.scrollTo(0, 0)
}

function onSearch(value) {
  if (value === keyword.value) return
  keyword.value = value
  applyFilter()
}

function onAuthorChange(value) {
  authorId.value = value
  applyFilter()
}

function onDayChange() {
  applyFilter()
}

function clearFilters() {
  keyword.value = ''
  authorId.value = null
  day.value = ''
  applyFilter()
}

function scrollToCompose() {
  document.getElementById('daily-compose')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function submit() {
  if (!form.done.trim() && !form.plan.trim() && !form.issues.trim()) {
    return message.warning('日报内容不能为空')
  }
  submitting.value = true
  try {
    const data = await api.post('/posts', {
      category: 'daily',
      title: form.title,
      day: form.day,
      done: form.done,
      plan: form.plan,
      issues: form.issues,
      cover: form.cover || undefined,
    })
    message.success('日报已提交 ✅')
    form.title = ''
    form.done = ''
    form.plan = ''
    form.issues = ''
    router.push('/post/' + data.id)
  } catch (e) {
    message.error(e.message)
  } finally {
    submitting.value = false
  }
}

function onUploaded(data) {
  const md = data.type.startsWith('image/') ? `![](${data.url})` : `[${data.filename}](${data.url})`
  form.done = form.done ? form.done + '\n' + md : md
}

const coverInput = ref(null)
const coverUploading = ref(false)

async function onCoverChange(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) return message.warning('请选择图片文件')
  if (file.size > 10 * 1024 * 1024) return message.warning('图片不能超过 10MB')
  coverUploading.value = true
  try {
    const data = await api.uploadFile(file)
    form.cover = data.url
  } catch (err) {
    message.error(err.message)
  } finally {
    coverUploading.value = false
  }
}

function removeCover() {
  form.cover = ''
}

function onPageChange(p) {
  page.value = p
  load()
  window.scrollTo(0, 0)
}

onMounted(() => {
  load()
  loadCheckin()
  loadMembers()
  loadOverview()
})
</script>

<template>
  <div class="page-head">
    <h1>📝 工作日报</h1>
    <p>今天做了什么、明天做什么、卡在了哪里</p>
  </div>

  <!-- 自己今天交了没，一眼可见 -->
  <div v-if="auth.isLoggedIn && myToday !== null" class="daily-mine" :class="myToday ? 'daily-mine-ok' : 'daily-mine-todo'">
    <span v-if="myToday">✅ 你今天已经交过日报了</span>
    <template v-else>
      <span>⏰ 你今天还没交日报</span>
      <button class="daily-mine-btn" @click="scrollToCompose">去填写</button>
    </template>
  </div>

  <section v-if="checkin" class="checkin-card">
    <h2>📋 今日日报提交情况</h2>
    <div class="checkin-row">
      <span class="checkin-tag checkin-done">✅ 已交 {{ checkin.done.length }} 人</span>
      <span v-if="checkin.done.length" class="checkin-names">{{ checkin.done.map((d) => d.username).join('、') }}</span>
      <span v-else class="text-dim">暂无</span>
    </div>
    <div class="checkin-row">
      <span class="checkin-tag checkin-missing">⏳ 未交 {{ checkin.missing.length }} 人</span>
      <span v-if="checkin.missing.length" class="checkin-names checkin-missing-names">
        {{ checkin.missing.map((m) => m.username).join('、') }}
      </span>
      <span v-else class="text-dim">全员已交 🎉</span>
    </div>
  </section>

  <section v-if="auth.isLoggedIn && overviewGrid.rows.length" class="daily-overview">
    <div class="daily-overview-head">
      <h2>📊 提交总览</h2>
      <div class="daily-month-nav">
        <button @click="shiftMonth(-1)">‹ 上月</button>
        <span class="daily-month-label">{{ overviewMonth }}</span>
        <button :disabled="isThisMonth" @click="shiftMonth(1)">下月 ›</button>
      </div>
    </div>
    <p class="text-dim daily-overview-tip">实心点 = 当天交了日报，周末浅色显示，点月份可切换</p>
    <div class="daily-grid-wrap">
      <table class="daily-grid">
        <thead>
          <tr>
            <th class="daily-grid-name">成员</th>
            <th
              v-for="d in overviewGrid.days"
              :key="d.d"
              :class="{ 'is-weekend': d.weekend, 'is-today': d.isToday, 'is-future': d.future }"
            >
              {{ d.d }}
            </th>
            <th class="daily-grid-total">合计</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in overviewGrid.rows" :key="row.id">
            <td class="daily-grid-name">{{ row.name }}</td>
            <td
              v-for="(cell, i) in row.cells"
              :key="i"
              :class="{
                'is-done': cell,
                'is-weekend': overviewGrid.days[i].weekend,
                'is-today': overviewGrid.days[i].isToday,
                'is-future': overviewGrid.days[i].future,
              }"
            >
              <span v-if="cell" class="daily-dot" />
            </td>
            <td class="daily-grid-total">{{ row.count }} 天</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section v-if="auth.isLoggedIn" id="daily-compose" class="compose-card">
    <h2>📅 提交日报</h2>
    <n-form label-placement="top">
      <p class="text-dim" style="margin-bottom: 6px">✍️ 三段内容都支持 Markdown 排版：<code># 标题</code>、<code>- 列表</code>、<code>**加粗**</code>、代码块、链接等</p>
      <n-form-item label="归属日期">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
          <input v-model="form.day" type="date" class="daily-date" />
          <span class="text-dim" style="font-size: 12px">默认今天；忘了写也可以改成往期日期补交</span>
        </div>
      </n-form-item>
      <n-form-item label="标题">
        <n-input v-model:value="form.title" maxlength="100" placeholder="标题（可留空，自动按归属日期生成）" />
      </n-form-item>
      <n-form-item label="头图（可选）">
        <div style="display: flex; align-items: center; gap: 12px">
          <div class="cover-box" @click="coverInput.click()">
            <img v-if="form.cover" :src="form.cover" alt="" />
            <span v-else>＋ 上传头图</span>
          </div>
          <n-button v-if="form.cover" size="small" @click="removeCover">移除</n-button>
          <input ref="coverInput" type="file" accept="image/*" style="display: none" @change="onCoverChange" />
        </div>
      </n-form-item>
      <n-form-item label="✅ 今天完成了什么">
        <n-input v-model:value="form.done" type="textarea" :rows="4" maxlength="10000" placeholder="今天做的工作、完成的任务、推进到哪一步了…" />
      </n-form-item>
      <div style="margin-bottom: 6px">
        <FileUploadButton @uploaded="onUploaded" />
        <span class="text-dim" style="margin-left: 8px; font-size: 12px">上传后插入到「今天完成」</span>
      </div>
      <n-form-item label="📋 明天计划做什么">
        <n-input v-model:value="form.plan" type="textarea" :rows="3" maxlength="10000" placeholder="明天的计划与安排…" />
      </n-form-item>
      <n-form-item label="⚠️ 遇到的问题（可选）">
        <n-input v-model:value="form.issues" type="textarea" :rows="3" maxlength="10000" placeholder="遇到的困难、需要谁协助、卡住的点…" />
      </n-form-item>
      <n-button type="primary" :loading="submitting" @click="submit">提交日报</n-button>
    </n-form>
  </section>
  <div v-else class="login-tip">👉 <router-link to="/login">登录</router-link> 后即可提交日报</div>

  <!-- 回看：按成员 / 日期 / 关键词筛选 -->
  <div class="daily-filters">
    <SearchInput placeholder="搜索日报内容…" @search="onSearch" />
    <div class="daily-filter-row">
      <n-select
        v-if="auth.isLoggedIn && memberOptions.length"
        :value="authorId"
        :options="memberOptions"
        placeholder="全部成员"
        clearable
        style="width: 160px"
        @update:value="onAuthorChange"
      />
      <input v-model="day" type="date" class="daily-date" @change="onDayChange" />
      <button v-if="hasFilter" class="daily-clear" @click="clearFilters">清除筛选</button>
    </div>
  </div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="empty">加载失败：{{ error }}</div>
  <template v-else>
    <div v-if="hasFilter" class="daily-summary">
      筛选到 {{ total }} 篇日报
      <button class="daily-clear" @click="clearFilters">清除筛选</button>
    </div>

    <div v-if="!posts.length" class="empty">
      {{ hasFilter ? '这个条件下没有日报，换个条件试试' : '还没有日报，提交今天的第一份吧' }}
    </div>

    <div v-for="group in grouped" :key="group.key" class="daily-group">
      <div class="daily-group-head">
        <span class="daily-group-day">{{ fmtDayLabel(group.key) }}</span>
        <span class="text-dim">{{ group.items.length }} 篇</span>
      </div>
      <div class="post-list">
        <PostCard v-for="p in group.items" :key="p.id" :post="p" />
      </div>
    </div>

    <PaginationBar :page="page" :total="total" :page-size="PAGE_SIZE" @change="onPageChange" />
  </template>
</template>
