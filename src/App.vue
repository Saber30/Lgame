<script setup>
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme, zhCN, dateZhCN } from 'naive-ui'
import SiteHeader from './components/SiteHeader.vue'
import { useThemeStore } from './stores/theme'

const theme = useThemeStore()
const naiveTheme = computed(() => (theme.theme === 'dark' ? darkTheme : null))
</script>

<template>
  <n-config-provider :theme="naiveTheme" :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-dialog-provider>
        <SiteHeader />
        <main class="container">
          <router-view />
        </main>
        <footer class="site-footer">LGame 工作室 · lgame.men · 用热爱做游戏</footer>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
