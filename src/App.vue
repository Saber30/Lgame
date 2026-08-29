<script setup>
import SiteHeader from './components/SiteHeader.vue'
</script>

<template>
  <SiteHeader />
  <main class="container">
    <router-view />
  </main>
  <footer class="site-footer">LGame 工作室 · lgame.men · 用热爱做游戏</footer>
</template>
