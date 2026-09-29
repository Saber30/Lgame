<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'
import { renderMarkdown } from '../utils/markdown'
import { timeAgo } from '../utils/format'
import DesignGraph from '../components/DesignGraph.vue'

const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()

const CATEGORIES = {
  concept: { label: '核心策划', color: '#6c5ce7' },
  system: { label: '系统策划', color: '#00d2ff' },
  numeric: { label: '数值策划', color: '#2ed573' },
  level: { label: '关卡策划', color: '#ff6b81' },
  narrative: { label: '剧情策划', color: '#f5a623' },
  art: { label: '美术需求', color: '#38dbff' },
  audio: { label: '音频策划', color: '#a99cf5' },
  ui: { label: 'UI/UX', color: '#ff9ff3' },
  tech: { label: '技术策划', color: '#ff9f43' },
  monetization: { label: '商业化', color: '#10ac84' },
  testing: { label: '测试验收', color: '#8395a7' },
  other: { label: '其他', color: '#576574' },
}

const categoryOptions = computed(() =>
  Object.entries(CATEGORIES).map(([value, c]) => ({ label: c.label, value }))
)

function catLabel(c) {
  return CATEGORIES[c]?.label || '其他'
}
function catColor(c) {
  return CATEGORIES[c]?.color || '#576574'
}

const docs = ref([])
const selectedId = ref(null)
const collapsed = ref(new Set())
const loading = ref(true)
const error = ref('')
const needLogin = ref(false)

const showEdit = ref(false)
const editing = ref(null)
const editParentId = ref(null)
const form = reactive({ title: '', category: 'other', content: '' })
const submitting = ref(false)

const selectedDoc = computed(() => docs.value.find((d) => d.id === selectedId.value) || null)

const viewMode = ref('tree')
const links = ref([])
const showLink = ref(false)
const linkSubmitting = ref(false)
const linkForm = reactive({ to_id: null, relation: 'relates' })

const RELATIONS = [
  { label: '依赖', value: 'depends' },
  { label: '参考', value: 'references' },
  { label: '影响', value: 'affects' },
  { label: '相关', value: 'relates' },
]

function relLabel(r) {
  return RELATIONS.find((x) => x.value === r)?.label || '相关'
}

const linkTargets = computed(() =>
  docs.value.filter((d) => d.id !== selectedId.value).map((d) => ({ label: d.title, value: d.id }))
)

const outgoingLinks = computed(() =>
  links.value
    .filter((l) => l.from_id === selectedId.value)
    .map((l) => ({ ...l, target: docs.value.find((d) => d.id === l.to_id) }))
    .filter((l) => l.target)
)

async function loadLinks() {
  try {
    const data = await api.get('/design-links')
    links.value = data.links
  } catch {
    links.value = []
  }
}

function openAddLink() {
  linkForm.to_id = null
  linkForm.relation = 'relates'
  showLink.value = true
}

async function submitLink() {
  if (!linkForm.to_id) return message.warning('请选择要关联的文档')
  linkSubmitting.value = true
  try {
    await api.post('/design-links', {
      from_id: selectedId.value,
      to_id: linkForm.to_id,
      relation: linkForm.relation,
    })
    message.success('已关联')
    showLink.value = false
    loadLinks()
  } catch (e) {
    message.error(e.message)
  } finally {
    linkSubmitting.value = false
  }
}

async function removeLink(l) {
  try {
    await api.del('/design-links/' + l.id)
    message.success('已取消关联')
    loadLinks()
  } catch (e) {
    message.error(e.message)
  }
}

function onGraphSelect(id) {
  selectedId.value = id
  viewMode.value = 'tree'
}

const tree = computed(() => buildTree(docs.value))

const flatTree = computed(() => {
  const out = []
  flatten(tree.value, 0, out)
  return out
})

function buildTree(list) {
  const map = new Map()
  list.forEach((d) => map.set(d.id, { ...d, children: [] }))
  const roots = []
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function flatten(nodes, depth, out) {
  for (const n of nodes) {
    out.push({ ...n, depth })
    if (!collapsed.value.has(n.id) && n.children && n.children.length) {
      flatten(n.children, depth + 1, out)
    }
  }
}

function toggleCollapse(n) {
  if (!n.children || !n.children.length) return
  const s = new Set(collapsed.value)
  if (s.has(n.id)) s.delete(n.id)
  else s.add(n.id)
  collapsed.value = s
}

function selectDoc(id) {
  selectedId.value = id
}

async function load() {
  loading.value = true
  error.value = ''
  needLogin.value = false
  try {
    const data = await api.get('/design-docs')
    docs.value = data.docs
    if (!selectedId.value && docs.value.length) selectedId.value = docs.value[0].id
    await loadLinks()
  } catch (e) {
    // 没登录不算「加载失败」，否则访客会以为站点坏了
    needLogin.value = e.status === 401
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openCreateRoot() {
  editing.value = null
  editParentId.value = null
  form.title = ''
  form.category = 'other'
  form.content = ''
  showEdit.value = true
}

function openCreateChild(doc) {
  editing.value = null
  editParentId.value = doc.id
  form.title = ''
  form.category = doc.category
  form.content = ''
  showEdit.value = true
}

function openEdit(doc) {
  editing.value = doc
  editParentId.value = doc.parent_id
  form.title = doc.title
  form.category = doc.category
  form.content = doc.content
  showEdit.value = true
}

async function submit() {
  if (!form.title.trim()) return message.warning('请填写标题')
  submitting.value = true
  try {
    if (editing.value) {
      await api.patch('/design-docs/' + editing.value.id, { ...form, parent_id: editParentId.value })
      message.success('已保存')
    } else {
      await api.post('/design-docs', { ...form, parent_id: editParentId.value })
      message.success('已创建')
    }
    showEdit.value = false
    load()
  } catch (e) {
    message.error(e.message)
  } finally {
    submitting.value = false
  }
}

function remove(doc) {
  dialog.warning({
    title: '删除',
    content: `确定删除「${doc.title}」吗？其下所有子文档也会一起删除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.del('/design-docs/' + doc.id)
        message.success('已删除')
        if (selectedId.value === doc.id) selectedId.value = null
        load()
      } catch (e) {
        message.error(e.message)
      }
    },
  })
}

onMounted(load)
</script>

<template>
  <div class="page-head">
    <h1>📋 策划案</h1>
    <p>树视图撰写策划，知识图谱看关联</p>
  </div>

  <div v-if="auth.isLoggedIn" class="design-toolbar">
    <n-button type="primary" size="small" @click="openCreateRoot">+ 新建策划文档</n-button>
    <div class="view-switch">
      <button :class="{ active: viewMode === 'tree' }" @click="viewMode = 'tree'">🌲 树视图</button>
      <button :class="{ active: viewMode === 'graph' }" @click="viewMode = 'graph'">🕸️ 知识图谱</button>
    </div>
  </div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="needLogin" class="empty">
    🔒 策划案与知识图谱需要登录后查看 · <router-link to="/login">去登录</router-link>
  </div>
  <div v-else-if="error" class="empty">加载失败：{{ error }}</div>
  <div v-else-if="viewMode === 'graph'" class="design-graph">
    <DesignGraph :docs="docs" :links="links" @select="onGraphSelect" />
  </div>
  <div v-else class="design-layout">
    <div class="design-tree">
      <div v-if="!flatTree.length" class="text-dim" style="padding: 12px">还没有策划文档，点「新建」开始</div>
      <div
        v-for="n in flatTree"
        :key="n.id"
        class="tree-node"
        :style="{ paddingLeft: n.depth * 18 + 10 + 'px' }"
      >
        <span class="tree-toggle" @click.stop="toggleCollapse(n)">
          {{ n.children && n.children.length ? (collapsed.has(n.id) ? '▸' : '▾') : '' }}
        </span>
        <span class="tree-label" :class="{ 'tree-active': n.id === selectedId }" @click="selectDoc(n.id)">
          <span class="tree-dot" :style="{ background: catColor(n.category) }"></span>
          {{ n.title }}
        </span>
      </div>
    </div>

    <div class="design-doc">
      <template v-if="selectedDoc">
        <div class="design-doc-head">
          <h2>{{ selectedDoc.title }}</h2>
          <span class="tree-dot" :style="{ background: catColor(selectedDoc.category) }"></span>
          <span class="text-dim">{{ catLabel(selectedDoc.category) }}</span>
          <span class="text-dim" style="margin-left: auto">👤 {{ selectedDoc.author_name }} · {{ timeAgo(selectedDoc.created_at) }}</span>
        </div>
        <div v-if="selectedDoc.content" class="post-content" v-html="renderMarkdown(selectedDoc.content)"></div>
        <div v-else class="empty">这个文档还没有内容，点「编辑」撰写</div>

        <div class="design-links">
          <h4>🔗 关联的策划（{{ outgoingLinks.length }}）</h4>
          <div v-for="l in outgoingLinks" :key="l.id" class="design-link-item">
            <span class="link-rel">{{ relLabel(l.relation) }}</span>
            <a @click="selectDoc(l.target.id)">{{ l.target.title }}</a>
            <n-button size="tiny" quaternary @click="removeLink(l)">✕</n-button>
          </div>
          <div v-if="!outgoingLinks.length" class="text-dim" style="font-size: 13px">
            还没有关联，点下面「添加关联」建立文档间的关系
          </div>
        </div>

        <div class="design-doc-actions">
          <n-button size="small" @click="openCreateChild(selectedDoc)">+ 子文档</n-button>
          <n-button size="small" @click="openAddLink">🔗 添加关联</n-button>
          <n-button size="small" @click="openEdit(selectedDoc)">编辑</n-button>
          <n-button v-if="auth.isAdmin" size="small" type="error" secondary @click="remove(selectedDoc)">删除</n-button>
        </div>
      </template>
      <div v-else class="empty">从左侧选择一个文档查看</div>
    </div>
  </div>

  <n-modal
    v-model:show="showEdit"
    preset="card"
    :title="editing ? '编辑文档' : editParentId ? '新建子文档' : '新建策划文档'"
    style="width: 640px"
  >
    <n-form label-placement="top">
      <n-form-item label="标题">
        <n-input v-model:value="form.title" maxlength="100" placeholder="例如：战斗系统设计" />
      </n-form-item>
      <n-form-item label="策划类型">
        <n-select v-model:value="form.category" :options="categoryOptions" />
      </n-form-item>
      <n-form-item label="内容（支持 Markdown）">
        <n-input v-model:value="form.content" type="textarea" :rows="14" placeholder="撰写策划内容…支持 Markdown 排版" />
      </n-form-item>
    </n-form>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 10px">
        <n-button @click="showEdit = false">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="submit">{{ editing ? '保存' : '创建' }}</n-button>
      </div>
    </template>
  </n-modal>

  <n-modal v-model:show="showLink" preset="card" title="添加关联" style="width: 480px">
    <n-form label-placement="top">
      <n-form-item label="关联到哪个策划文档">
        <n-select v-model:value="linkForm.to_id" :options="linkTargets" filterable placeholder="选择文档" />
      </n-form-item>
      <n-form-item label="关系类型">
        <n-select v-model:value="linkForm.relation" :options="RELATIONS" />
      </n-form-item>
    </n-form>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 10px">
        <n-button @click="showLink = false">取消</n-button>
        <n-button type="primary" :loading="linkSubmitting" @click="submitLink">关联</n-button>
      </div>
    </template>
  </n-modal>
</template>