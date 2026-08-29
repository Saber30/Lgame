import { defineStore } from 'pinia'

const STORAGE_KEY = 'lgame-theme'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: 'dark',
  }),
  actions: {
    init() {
      const saved = localStorage.getItem(STORAGE_KEY)
      this.theme = saved === 'light' || saved === 'dark' ? saved : 'dark'
      this.apply()
    },
    apply() {
      document.documentElement.classList.toggle('dark', this.theme === 'dark')
      localStorage.setItem(STORAGE_KEY, this.theme)
    },
    toggle() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      this.apply()
    },
  },
})
