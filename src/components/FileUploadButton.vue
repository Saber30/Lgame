<script setup>
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { api } from '../api'

const emit = defineEmits(['uploaded'])
const message = useMessage()
const fileInput = ref(null)
const uploading = ref(false)

async function onFileChange(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    message.warning('文件不能超过 10MB')
    return
  }
  uploading.value = true
  try {
    const data = await api.uploadFile(file)
    emit('uploaded', data)
    message.success('上传成功')
  } catch (err) {
    message.error(err.message)
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <span>
    <n-button size="small" :loading="uploading" @click="fileInput.click()">📎 上传附件</n-button>
    <input ref="fileInput" type="file" style="display: none" @change="onFileChange" />
  </span>
</template>