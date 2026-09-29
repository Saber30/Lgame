<script setup>
import { onMounted, onUnmounted } from 'vue'
import { tsParticles } from '@tsparticles/engine'
import { loadSlim } from '@tsparticles/slim'

const CONTAINER_ID = 'lgame-particles'
let engineReady = false

onMounted(async () => {
  try {
    if (!engineReady) {
      await loadSlim(tsParticles)
      engineReady = true
    }
    await tsParticles.load({
      id: CONTAINER_ID,
      options: {
        fullScreen: { enable: false },
        fpsLimit: 60,
        detectRetina: true,
        particles: {
          number: { value: 55, density: { enable: true, width: 1200, height: 800 } },
          color: { value: ['#1677ff', '#7c3aed', '#00d2ff', '#00e5ff'] },
          shape: { type: 'circle' },
          opacity: { value: { min: 0.25, max: 0.6 } },
          size: { value: { min: 1, max: 2.8 } },
          links: {
            enable: true,
            color: '#1677ff',
            distance: 150,
            opacity: 0.22,
            width: 1,
          },
          move: {
            enable: true,
            speed: 0.9,
            direction: 'none',
            random: true,
            straight: false,
            outModes: { default: 'out' },
          },
        },
        interactivity: {
          detectsOn: 'window',
          events: {
            onHover: { enable: true, mode: 'grab' },
            onClick: { enable: true, mode: 'push' },
            resize: { enable: true },
          },
          modes: {
            grab: { distance: 170, links: { opacity: 0.45 } },
            push: { quantity: 3 },
          },
        },
      },
    })
  } catch (e) {
    console.error('粒子背景加载失败:', e)
  }
})

onUnmounted(() => {
  tsParticles.domItem(CONTAINER_ID)?.destroy()
})
</script>

<template>
  <div :id="CONTAINER_ID" class="particle-bg" aria-hidden="true"></div>
</template>
