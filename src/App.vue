<script setup>
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme, zhCN, dateZhCN } from 'naive-ui'
import AppSidebar from './components/AppSidebar.vue'
import AppTopbar from './components/AppTopbar.vue'
import SakuraBackground from './components/SakuraBackground.vue'
import PixelPet from './components/PixelPet.vue'
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
        <SakuraBackground />
        <PixelPet />
        <div class="app-shell">
          <AppSidebar />
          <div class="app-main">
            <AppTopbar />
            <main class="app-content">
              <router-view v-slot="{ Component, route }">
                <component :is="Component" :key="route.fullPath" />
              </router-view>
            </main>
          </div>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
