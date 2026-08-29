<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import { timeAgo } from '../utils/format'

const props = defineProps({
  postId: { type: Number, required: true },
  comments: { type: Array, default: () => [] },
})
const emit = defineEmits(['added'])

const auth = useAuthStore()
const content = ref('')
const submitting = ref(false)

async function submit() {
  const text = content.value.trim()
  if (!text) return ElMessage.warning('评论不能为空')
  submitting.value = true
  try {
    await api.post(`/posts/${props.postId}/comments`, { content: text })
    content.value = ''
    ElMessage.success('评论成功')
    emit('added')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="comments-section">
    <h2>评论（{{ comments.length }}）</h2>

    <div v-if="comments.length">
      <div v-for="c in comments" :key="c.id" class="comment">
        <div class="comment-head">
          <strong>{{ c.author_name }}</strong>
          <span>{{ timeAgo(c.created_at) }}</span>
        </div>
        <p>{{ c.content }}</p>
      </div>
    </div>
    <div v-else class="empty">还没有评论，来抢沙发</div>

    <form v-if="auth.isLoggedIn" class="comment-form" @submit.prevent="submit">
      <el-input v-model="content" type="textarea" :rows="3" maxlength="2000" placeholder="说点什么…" />
      <el-button type="primary" native-type="submit" :loading="submitting" style="margin-top: 10px">
        发表评论
      </el-button>
    </form>
    <div v-else class="login-tip">👉 <router-link to="/login">登录</router-link> 后参与评论</div>
  </section>
</template>
