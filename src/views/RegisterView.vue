<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const message = useMessage()
const form = reactive({ username: '', email: '', password: '', confirm: '' })
const submitting = ref(false)

async function submit() {
  if (form.username.trim().length < 2) return message.warning('用户名至少 2 个字符')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return message.warning('邮箱格式不正确')
  if (form.password.length < 6) return message.warning('密码至少 6 位')
  if (form.password !== form.confirm) return message.warning('两次输入的密码不一致')
  submitting.value = true
  try {
    const data = await auth.register(form.username, form.email, form.password)
    message.success(data.message || '注册成功')
    router.push('/')
  } catch (e) {
    message.error(e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>注册</h1>
      <n-form label-placement="top">
        <n-form-item label="用户名">
          <n-input v-model:value="form.username" maxlength="20" placeholder="2-20 个字符，中文/字母/数字/下划线" />
        </n-form-item>
        <n-form-item label="邮箱">
          <n-input v-model:value="form.email" placeholder="you@example.com" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="至少 6 位" />
        </n-form-item>
        <n-form-item label="确认密码">
          <n-input v-model:value="form.confirm" type="password" show-password-on="click" placeholder="再输入一次" />
        </n-form-item>
        <n-button type="primary" block :loading="submitting" @click="submit">注册</n-button>
      </n-form>
      <div class="auth-switch">已有账号？<router-link to="/login">去登录</router-link></div>
    </div>
  </div>
</template>
