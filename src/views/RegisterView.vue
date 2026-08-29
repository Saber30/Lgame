<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const form = reactive({ username: '', email: '', password: '', confirm: '' })
const submitting = ref(false)

async function submit() {
  if (form.username.trim().length < 2) return ElMessage.warning('用户名至少 2 个字符')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return ElMessage.warning('邮箱格式不正确')
  if (form.password.length < 6) return ElMessage.warning('密码至少 6 位')
  if (form.password !== form.confirm) return ElMessage.warning('两次输入的密码不一致')
  submitting.value = true
  try {
    const data = await auth.register(form.username, form.email, form.password)
    ElMessage.success(data.message || '注册成功')
    router.push('/')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>注册</h1>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" maxlength="20" placeholder="2-20 个字符，中文/字母/数字/下划线" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="you@example.com" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="form.confirm" type="password" show-password placeholder="再输入一次" />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="submitting" style="width: 100%">
          注册
        </el-button>
      </el-form>
      <div class="auth-switch">已有账号？<router-link to="/login">去登录</router-link></div>
    </div>
  </div>
</template>
