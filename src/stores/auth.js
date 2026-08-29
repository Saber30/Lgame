import { defineStore } from 'pinia'
import { api } from '../api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    initialized: false,
  }),
  getters: {
    isLoggedIn: (s) => !!s.user,
    isAdmin: (s) => s.user?.role === 'admin',
  },
  actions: {
    async fetchMe() {
      try {
        const data = await api.get('/me')
        this.user = data.user
      } catch {
        this.user = null
      } finally {
        this.initialized = true
      }
    },
    async login(account, password) {
      const data = await api.post('/login', { account, password })
      this.user = data.user
      return data
    },
    async register(username, email, password) {
      const data = await api.post('/register', { username, email, password })
      this.user = data.user
      return data
    },
    async logout() {
      try {
        await api.post('/logout')
      } catch {
        // 即使后端登出失败也清空本地状态
      }
      this.user = null
    },
  },
})
