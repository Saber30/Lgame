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
</script>

<template>
  <article class="post-card" @click="router.push('/post/' + post.id)">
    <div class="post-meta">
      <span class="badge" :class="'badge-' + post.category">{{ categoryLabel(post.category) }}</span>
      <span class="post-author">{{ post.author_name }}</span>
      <span class="post-time">{{ timeAgo(post.created_at) }}</span>
      <span v-if="post.like_count" class="post-time">👍 {{ post.like_count }}</span>
    </div>
    <h3 class="post-title">{{ post.title }}</h3>
    <p v-if="excerpt" class="post-excerpt">{{ excerpt }}</p>
    <span v-if="post.link" class="source-hint">🔗 附原文链接</span>
  </article>
</template>
