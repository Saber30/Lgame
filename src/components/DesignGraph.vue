<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps({
  docs: { type: Array, default: () => [] },
  links: { type: Array, default: () => [] },
})
const emit = defineEmits(['select'])

const CATEGORY_COLOR = {
  concept: '#6c5ce7',
  system: '#00d2ff',
  numeric: '#2ed573',
  level: '#ff6b81',
  narrative: '#f5a623',
  art: '#38dbff',
  audio: '#a99cf5',
  ui: '#ff9ff3',
  tech: '#ff9f43',
  monetization: '#10ac84',
  testing: '#8395a7',
  other: '#576574',
}

const RELATION = {
  depends: { label: '依赖', color: '#ff6b81' },
  references: { label: '参考', color: '#00d2ff' },
  affects: { label: '影响', color: '#f5a623' },
  relates: { label: '相关', color: '#8395a7' },
}

const WIDTH = 900
const HEIGHT = 560
const nodes = ref([])

function catColor(c) {
  return CATEGORY_COLOR[c] || '#576574'
}

function computeLayout() {
  const ns = props.docs.map((d) => ({ id: d.id, title: d.title, category: d.category, x: 0, y: 0 }))
  const n = ns.length
  if (!n) {
    nodes.value = []
    return
  }
  const cx = WIDTH / 2
  const cy = HEIGHT / 2
  const R = Math.min(WIDTH, HEIGHT) / 2 - 70
  ns.forEach((nd, i) => {
    const angle = (i / n) * 2 * Math.PI
    nd.x = cx + Math.cos(angle) * R
    nd.y = cy + Math.sin(angle) * R
  })

  const byId = new Map(ns.map((nd) => [nd.id, nd]))
  const ls = props.links.filter((l) => byId.has(l.from_id) && byId.has(l.to_id))

  for (let iter = 0; iter < 250; iter++) {
    // 节点互斥
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = ns[i]
        const b = ns[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let dist = Math.hypot(dx, dy) || 1
        const rep = 26000 / (dist * dist)
        const fx = (dx / dist) * rep
        const fy = (dy / dist) * rep
        a.x += fx
        a.y += fy
        b.x -= fx
        b.y -= fy
      }
    }
    // 边的引力
    for (const l of ls) {
      const a = byId.get(l.from_id)
      const b = byId.get(l.to_id)
      let dx = b.x - a.x
      let dy = b.y - a.y
      let dist = Math.hypot(dx, dy) || 1
      const att = (dist - 165) * 0.012
      const fx = (dx / dist) * att
      const fy = (dy / dist) * att
      a.x += fx
      a.y += fy
      b.x -= fx
      b.y -= fy
    }
    // 向心
    for (const nd of ns) {
      nd.x += (cx - nd.x) * 0.008
      nd.y += (cy - nd.y) * 0.008
    }
    // 边界
    for (const nd of ns) {
      nd.x = Math.max(66, Math.min(WIDTH - 66, nd.x))
      nd.y = Math.max(48, Math.min(HEIGHT - 42, nd.y))
    }
  }
  nodes.value = ns
}

const nodeById = computed(() => new Map(nodes.value.map((nd) => [nd.id, nd])))
const edges = computed(() =>
  props.links
    .map((l) => ({ ...l, a: nodeById.value.get(l.from_id), b: nodeById.value.get(l.to_id) }))
    .filter((e) => e.a && e.b)
)

onMounted(computeLayout)
watch(() => [props.docs, props.links], computeLayout, { deep: true })
</script>

<template>
  <div class="graph-wrap">
    <div v-if="!nodes.length" class="empty">还没有策划文档，先建文档再来看图谱</div>
    <svg v-else :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="graph-svg">
      <g>
        <line
          v-for="e in edges"
          :key="e.id"
          :x1="e.a.x"
          :y1="e.a.y"
          :x2="e.b.x"
          :y2="e.b.y"
          :stroke="(RELATION[e.relation] || RELATION.relates).color"
          stroke-width="1.5"
          stroke-opacity="0.55"
        />
      </g>
      <g v-for="nd in nodes" :key="nd.id" class="graph-node" @click="emit('select', nd.id)">
        <rect :x="nd.x - 58" :y="nd.y - 22" width="116" height="44" rx="7" class="node-body" />
        <rect :x="nd.x - 58" :y="nd.y - 22" width="116" height="19" rx="7" :fill="catColor(nd.category)" />
        <text :x="nd.x" :y="nd.y - 9" text-anchor="middle" class="node-title">
          {{ nd.title.length > 9 ? nd.title.slice(0, 9) + '…' : nd.title }}
        </text>
        <text :x="nd.x" :y="nd.y + 14" text-anchor="middle" class="node-sub">{{ nd.category }}</text>
        <circle :cx="nd.x - 58" :cy="nd.y + 2" r="4" class="node-port" />
        <circle :cx="nd.x + 58" :cy="nd.y + 2" r="4" class="node-port" />
      </g>
    </svg>
    <div class="graph-legend">
      <span v-for="(v, k) in RELATION" :key="k"><i :style="{ background: v.color }"></i>{{ v.label }}</span>
    </div>
  </div>
</template>
