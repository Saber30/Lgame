import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  NButton,
  NConfigProvider,
  NDialogProvider,
  NForm,
  NFormItem,
  NInput,
  NMessageProvider,
  NModal,
  NSelect,
  NSpace,
  NTable,
} from 'naive-ui'
import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/theme'
import './styles/main.css'

// 按需注册：全量 app.use(naive) 会注册 313 个组件，实际只用到这 11 个
const NAIVE_COMPONENTS = [
  NButton,
  NConfigProvider,
  NDialogProvider,
  NForm,
  NFormItem,
  NInput,
  NMessageProvider,
  NModal,
  NSelect,
  NSpace,
  NTable,
]

const app = createApp(App)

app.use(createPinia())
app.use(router)
for (const component of NAIVE_COMPONENTS) {
  app.component(`N${component.name}`, component)
}

// 应用初始主题（深色/浅色）
useThemeStore().init()

app.mount('#app')
