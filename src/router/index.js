import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue') },
  { path: '/news', name: 'news', component: () => import('../views/NewsView.vue') },
  { path: '/insight', name: 'insight', component: () => import('../views/CategoryView.vue'), props: { category: 'insight' } },
  { path: '/learn', name: 'learn', component: () => import('../views/CategoryView.vue'), props: { category: 'learn' } },
  { path: '/daily', name: 'daily', component: () => import('../views/DailyView.vue') },
  { path: '/timeline', name: 'timeline', component: () => import('../views/TimelineView.vue') },
  { path: '/post/:id', name: 'post', component: () => import('../views/PostView.vue'), props: true },
  { path: '/admin', name: 'admin', component: () => import('../views/AdminView.vue'), meta: { requiresAdmin: true } },
  { path: '/report', name: 'report', component: () => import('../views/ReportView.vue'), meta: { requiresAdmin: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized) await auth.fetchMe()
  if (to.meta.requiresAdmin && !auth.isAdmin) return { name: 'home' }
  return true
})

export default router
