<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { categoryLabel, timeAgo, parseDailyMeta } from '../utils/format'

const props = defineProps({
  post: { type: Object, required: true },
})
const router = useRouter()

const excerpt = computed(() => {
  if (props.post.category === 'daily') {
    return (parseDailyMeta(props.post.meta).done || '').slice(0, 120)
  }
  return (props.post.content || '').slice(0, 150)
})

const sourceMeta = computed(() => {
  try {
    return JSON.parse(props.post.meta || '{}')
  } catch {
    return {}
  }
})

const region = computed(() => sourceMeta.value.region || '')

function onImgError(e) {
  const box = e.target.closest('.post-card-thumb')
  if (box) box.style.display = 'none'
}

// 整块卡片可点，但点到真链接时交给链接自己处理（这样才能新标签页打开 / 右键复制）
function onCardClick(e) {
  if (e.target.closest('a')) return
  router.push('/post/' + props.post.id)
}
</script>

<template>
  <article class="post-card" :class="{ 'post-card-cover': post.cover }" @click="onCardClick">
    <div v-if="post.cover" class="post-card-thumb">
      <img :src="post.cover" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="onImgError" />
    </div>
    <div class="post-card-body">
      <div class="post-meta">
        <span class="badge" :class="'badge-' + post.category">{{ categoryLabel(post.category) }}</span>
        <span v-if="region === 'domestic'" class="badge badge-domestic">国内</span>
        <span v-if="region === 'overseas'" class="badge badge-overseas">国外</span>
        <span class="post-author">{{ post.author_name }}</span>
        <span class="post-time">{{ timeAgo(post.created_at) }}</span>
        <span v-if="post.like_count" class="post-time">👍 {{ post.like_count }}</span>
      </div>
      <h3 class="post-title">
        <router-link class="post-title-link" :to="'/post/' + post.id">{{ post.title }}</router-link>
      </h3>
      <p v-if="excerpt" class="post-excerpt">{{ excerpt }}</p>
      <span v-if="post.link" class="source-hint">🔗 附原文链接</span>
    </div>
  </article>
</template>
