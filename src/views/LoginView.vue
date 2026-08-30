<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const message = useMessage()
const form = reactive({ account: '', password: '' })
const submitting = ref(false)

async function submit() {
  if (!form.account || !form.password) return message.warning('请输入账号和密码')
  submitting.value = true
  try {
    await auth.login(form.account, form.password)
    message.success('登录成功')
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
      <h1>登录</h1>
      <n-form label-placement="top">
        <n-form-item label="用户名或邮箱">
          <n-input v-model:value="form.account" placeholder="用户名或邮箱" @keyup.enter="submit" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input
            v-model:value="form.password"
            type="password"
            show-password-on="click"
            placeholder="密码"
            @keyup.enter="submit"
          />
        </n-form-item>
        <n-button type="primary" block :loading="submitting" @click="submit">登录</n-button>
      </n-form>
      <div class="auth-switch">还没有账号？<router-link to="/register">立即注册</router-link></div>
    </div>
  </div>
</template>
