<script setup>
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme, zhCN, dateZhCN } from 'naive-ui'
import SiteHeader from './components/SiteHeader.vue'
import { useThemeStore } from './stores/theme'

const theme = useThemeStore()
const naiveTheme = computed(() => (theme.theme === 'dark' ? darkTheme : null))
const themeOverrides = computed(() => ({
  common: {
    primaryColor: theme.theme === 'dark' ? '#ededed' : '#000000',
    primaryColorHover: theme.theme === 'dark' ? '#ffffff' : '#333333',
    primaryColorPressed: theme.theme === 'dark' ? '#d0d0d0' : '#000000',
    primaryColorSuppl: theme.theme === 'dark' ? '#ededed' : '#000000',
    borderRadius: '10px',
  },
}))
</script>

<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-dialog-provider>
        <SiteHeader />
        <main class="container">
          <router-view v-slot="{ Component, route }">
            <component :is="Component" :key="route.fullPath" />
          </router-view>
        </main>
        <footer class="site-footer">LGame 工作室 · lgame.men · 用热爱做游戏</footer>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
