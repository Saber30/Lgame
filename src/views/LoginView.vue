<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const form = reactive({ account: '', password: '' })
const submitting = ref(false)

async function submit() {
  if (!form.account || !form.password) return ElMessage.warning('请输入账号和密码')
  submitting.value = true
  try {
    await auth.login(form.account, form.password)
    ElMessage.success('登录成功')
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
      <h1>登录</h1>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名或邮箱">
          <el-input v-model="form.account" placeholder="用户名或邮箱" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="密码" @keyup.enter="submit" />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="submitting" style="width: 100%">
          登录
        </el-button>
      </el-form>
      <div class="auth-switch">还没有账号？<router-link to="/register">立即注册</router-link></div>
    </div>
  </div>
</template>
