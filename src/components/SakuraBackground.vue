<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref(null)
let ctx = null
let raf = null
let W = 0
let H = 0
let petals = []
let dots = []
let t = 0

function resize() {
  const c = canvasRef.value
  if (!c) return
  W = c.width = window.innerWidth
  H = c.height = window.innerHeight
}

function makePetal(fromTop) {
  return {
    x: Math.random() * W,
    y: fromTop ? -20 - Math.random() * 60 : Math.random() * H - H,
    size: 6 + Math.random() * 9,
    speedY: 0.5 + Math.random() * 0.9,
    swayAmp: 18 + Math.random() * 45,
    swayPhase: Math.random() * Math.PI * 2,
    swaySpeed: 0.008 + Math.random() * 0.02,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.025,
    alpha: 0.45 + Math.random() * 0.5,
    hue: Math.random() < 0.25 ? '#ffc9de' : '#ff9fc4',
  }
}

function makeDot() {
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    r: 1 + Math.random() * 1.8,
    phase: Math.random() * Math.PI * 2,
    speed: 0.015 + Math.random() * 0.035,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
  }
}

function drawPetal(p) {
  const s = p.size
  ctx.save()
  ctx.translate(p.x + Math.sin(p.swayPhase) * p.swayAmp, p.y)
  ctx.rotate(p.rot)
  ctx.globalAlpha = p.alpha
  ctx.fillStyle = p.hue
  ctx.beginPath()
  ctx.moveTo(0, -s)
  ctx.bezierCurveTo(s * 0.85, -s * 0.55, s * 0.6, s * 0.65, 0, s)
  ctx.bezierCurveTo(-s * 0.6, s * 0.65, -s * 0.85, -s * 0.55, 0, -s)
  ctx.fill()
  ctx.restore()
}

function drawDot(d) {
  const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(d.phase + t * d.speed))
  ctx.save()
  ctx.globalAlpha = a * 0.35
  ctx.fillStyle = '#ffe66d'
  ctx.beginPath()
  ctx.arc(d.x, d.y, d.r * 2.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = a
  ctx.fillStyle = '#fffbe0'
  ctx.beginPath()
  ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function loop() {
  t += 1
  ctx.clearRect(0, 0, W, H)
  dots.forEach((d) => {
    d.x += d.vx
    d.y += d.vy
    if (d.x < -10) d.x = W + 10
    if (d.x > W + 10) d.x = -10
    if (d.y < -10) d.y = H + 10
    if (d.y > H + 10) d.y = -10
    drawDot(d)
  })
  petals.forEach((p, i) => {
    p.y += p.speedY
    p.swayPhase += p.swaySpeed
    p.rot += p.rotSpeed
    if (p.y > H + 30) petals[i] = makePetal(true)
    drawPetal(p)
  })
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  resize()
  petals = Array.from({ length: 30 }, () => makePetal(false))
  dots = Array.from({ length: 20 }, makeDot)
  window.addEventListener('resize', resize)
  loop()
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas ref="canvasRef" class="sakura-bg" aria-hidden="true"></canvas>
</template>
