<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import { categoryLabel, fmtDate, timeAgo } from '../utils/format'

const auth = useAuthStore()
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
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function toggleRole(u) {
  const toAdmin = u.role !== 'admin'
  try {
    await ElMessageBox.confirm(
      toAdmin ? '确定将该成员设为管理员吗？' : '确定将该管理员降为普通成员吗？',
      '提示',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await api.patch('/users/' + u.id, { role: toAdmin ? 'admin' : 'member' })
    ElMessage.success('已更新')
    load()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function deleteUser(u) {
  try {
    await ElMessageBox.confirm('确定删除该成员？TA 发布的所有帖子和评论也会一起删除。', '警告', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await api.del('/users/' + u.id)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function deletePost(p) {
  try {
    await ElMessageBox.confirm('确定删除这篇帖子？', '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await api.del('/posts/' + p.id)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

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
      <h2>👥 成员管理</h2>
      <el-table :data="users" style="width: 100%">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column label="用户名" min-width="140">
          <template #default="{ row }">
            {{ row.username }}
            <span v-if="row.role === 'admin'" class="badge badge-admin">管理员</span>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="180" class-name="text-dim" />
        <el-table-column prop="post_count" label="帖子" width="70" />
        <el-table-column prop="comment_count" label="评论" width="70" />
        <el-table-column label="注册时间" width="120">
          <template #default="{ row }">{{ fmtDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <span v-if="row.id === auth.user?.id" class="text-dim">当前账号</span>
            <template v-else>
              <el-button size="small" @click="toggleRole(row)">
                {{ row.role === 'admin' ? '设为成员' : '设为管理员' }}
              </el-button>
              <el-button size="small" type="danger" plain @click="deleteUser(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="admin-section">
      <h2>📄 最新帖子</h2>
      <div v-if="posts.length">
        <div v-for="p in posts" :key="p.id" class="admin-post-row">
          <span class="badge" :class="'badge-' + p.category">{{ categoryLabel(p.category) }}</span>
          <router-link :to="'/post/' + p.id" class="admin-post-title">{{ p.title }}</router-link>
          <span class="text-dim">{{ p.author_name }} · {{ timeAgo(p.created_at) }}</span>
          <el-button size="small" type="danger" plain @click="deletePost(p)">删除</el-button>
        </div>
      </div>
      <div v-else class="empty">还没有帖子</div>
    </section>
  </template>
  <div v-else-if="loading" class="loading">加载中…</div>
</template>
