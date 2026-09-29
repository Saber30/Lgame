import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        // 第三方库单独成块：以后改业务代码，用户不必重新下载整个包
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](vue|vue-router|pinia|@vue)[\\/]/.test(id)) return 'vendor-vue'
          if (id.includes('naive-ui')) return 'vendor-naive'
          if (id.includes('markdown-it') || id.includes('dompurify')) return 'vendor-markdown'
          return 'vendor'
        },
      },
    },
  },
  server: {
    proxy: {
      // 本地开发时把 /api 转发到 wrangler dev 起的 Worker（默认 8787 端口）
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
