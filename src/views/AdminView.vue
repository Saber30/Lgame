<script setup>
import { computed, onMounted, ref } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import { categoryLabel, fmtDate, timeAgo } from '../utils/format'

const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const stats = ref(null)
const users = ref([])
const posts = ref([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const [s, ud, pd] = await Promise.all([
      api.get('/stats'),
      api.get('/users'),
      api.get('/posts?pageSize=30'),
    ])
    stats.value = s
    users.value = ud.users
    posts.value = pd.posts
  } catch (e) {
    message.error(e.message)
  } finally {
    loading.value = false
  }
}

function toggleRole(u) {
  const toAdmin = u.role !== 'admin'
  dialog.warning({
    title: '提示',
    content: toAdmin ? '确定将该成员设为管理员吗？' : '确定将该管理员降为普通成员吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.patch('/users/' + u.id, { role: toAdmin ? 'admin' : 'member' })
        message.success('已更新')
        load()
      } catch (e) {
        message.error(e.message)
      }
    },
  })
}

function resetPassword(u) {
  dialog.warning({
    title: '提示',
    content: `确定重置「${u.username}」的密码吗？重置后原密码立即失效。`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const data = await api.post(`/users/${u.id}/reset-password`)
        dialog.info({
          title: '密码已重置',
          content: `新密码：${data.password}`,
          positiveText: '知道了',
        })
      } catch (e) {
        message.error(e.message)
      }
    },
  })
}

function deleteUser(u) {
  dialog.warning({
    title: '警告',
    content: '确定删除该成员？TA 发布的所有帖子和评论也会一起删除。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.del('/users/' + u.id)
        message.success('已删除')
        load()
      } catch (e) {
        message.error(e.message)
      }
    },
  })
}

function deletePost(p) {
  dialog.warning({
    title: '提示',
    content: '确定删除这篇帖子？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.del('/posts/' + p.id)
        message.success('已删除')
        load()
      } catch (e) {
        message.error(e.message)
      }
    },
  })
}

const activityRank = computed(() =>
  [...users.value]
    .map((u) => ({ ...u, score: u.post_count * 3 + u.comment_count * 2 + (u.like_received || 0) }))
    .sort((a, b) => b.score - a.score)
)

onMounted(load)
</script>

<template>
  <div class="page-head">
    <h1>⚙️ 管理后台</h1>
    <p>管理工作室成员与站内内容</p>
  </div>

  <template v-if="stats">
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">{{ stats.users }}</div><div>成员</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.posts.news }}</div><div>游戏新闻</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.posts.insight }}</div><div>游戏心得</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.posts.learn }}</div><div>学习园地</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.posts.daily }}</div><div>工作日报</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.comments }}</div><div>评论</div></div>
    </div>

    <section class="admin-section">
      <h2>🏆 活跃度排行</h2>
      <div class="rank-list">
        <div v-for="(u, i) in activityRank" :key="u.id" class="rank-item">
          <span class="rank-no" :class="'rank-top-' + (i + 1)">{{ i + 1 }}</span>
          <span class="rank-name">{{ u.username }}</span>
          <span class="text-dim">帖子 {{ u.post_count }} · 评论 {{ u.comment_count }} · 获赞 {{ u.like_received || 0 }}</span>
          <span class="rank-score">{{ u.score }} 分</span>
        </div>
        <div v-if="!activityRank.length" class="empty">暂无成员</div>
      </div>
    </section>

    <section class="admin-section">
      <h2>👥 成员管理</h2>
      <div class="table-wrap">
        <n-table :single-line="false" :bordered="false">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>邮箱</th>
              <th>帖子</th>
              <th>评论</th>
              <th>获赞</th>
              <th>最后活跃</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>{{ u.id }}</td>
              <td>
                {{ u.username }}
                <span v-if="u.role === 'admin'" class="badge badge-admin">管理员</span>
              </td>
              <td class="text-dim">{{ u.email }}</td>
              <td>{{ u.post_count }}</td>
              <td>{{ u.comment_count }}</td>
              <td>{{ u.like_received || 0 }}</td>
              <td class="text-dim">{{ u.last_active ? timeAgo(u.last_active) : '从未' }}</td>
              <td class="text-dim">{{ fmtDate(u.created_at) }}</td>
              <td>
                <span v-if="u.id === auth.user?.id" class="text-dim">当前账号</span>
                <n-space v-else size="small">
                  <n-button size="small" @click="toggleRole(u)">
                    {{ u.role === 'admin' ? '设为成员' : '设为管理员' }}
                  </n-button>
                  <n-button size="small" @click="resetPassword(u)">重置密码</n-button>
                  <n-button size="small" type="error" secondary @click="deleteUser(u)">删除</n-button>
                </n-space>
              </td>
            </tr>
          </tbody>
        </n-table>
      </div>
    </section>

    <section class="admin-section">
      <h2>📄 最新帖子</h2>
      <div v-if="posts.length">
        <div v-for="p in posts" :key="p.id" class="admin-post-row">
          <span class="badge" :class="'badge-' + p.category">{{ categoryLabel(p.category) }}</span>
          <router-link :to="'/post/' + p.id" class="admin-post-title">{{ p.title }}</router-link>
          <span class="text-dim">{{ p.author_name }} · {{ timeAgo(p.created_at) }}</span>
          <n-button size="small" type="error" secondary @click="deletePost(p)">删除</n-button>
        </div>
      </div>
      <div v-else class="empty">还没有帖子</div>
    </section>
  </template>
  <div v-else-if="loading" class="loading">加载中…</div>
</template>
