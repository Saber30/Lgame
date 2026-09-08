# LGame 开发手册

面向开发人员的项目说明。本文档解释项目架构、如何修改现有功能、如何添加新功能、以及如何部署上线。

## 1. 项目概览

### 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + Vue Router 4 + Pinia 2 + **Naive UI** + markdown-it + DOMPurify |
| 后端 | Cloudflare **Workers**（纯 JS，ES Module） |
| 数据库 | Cloudflare **D1**（SQLite） |
| 文件存储 | Cloudflare **Workers KV**（免费 1GB） |
| 定时任务 | Cloudflare **Cron Triggers**（每 2 小时抓新闻） |
| AI | Cloudflare **Workers AI**（Qwen 翻译新闻） |

全部运行在 Cloudflare 免费额度内，无需付费、无需绑卡。

### 架构

```
┌──────────────────────────────────────────────┐
│  前端 Vue 3 单页应用（Vite 构建 → dist/）      │
│  router / stores / views / components / api   │
└────────────────┬─────────────────────────────┘
                 │  /api/*  (fetch JSON)
┌────────────────▼─────────────────────────────┐
│  后端 Cloudflare Worker                       │
│  worker/index.js   入口 + SPA回退 + Cron定时   │
│  worker/api.js     所有业务 API                │
│  worker/news.js    RSS 抓取 + AI 翻译          │
└──────┬──────────────────┬─────────────────────┘
       │ D1 (SQL)         │ KV (文件)
┌──────▼──────┐    ┌──────▼──────┐
│ D1 数据库   │    │ KV 存储      │
│ 6 张表      │    │ 上传的文件   │
└─────────────┘    └─────────────┘
```

## 2. 目录结构

```
lgame/
├── index.html               # Vite 入口（SPA 壳）
├── vite.config.js           # Vite 配置（/api 开发代理）
├── package.json             # 前端依赖 + 构建脚本
├── wrangler.toml            # 部署配置（D1/KV/AI/Cron 绑定）
├── schema.sql               # 数据库表结构（建表/迁移用）
├── src/                     # 前端源码
│   ├── main.js              # 入口：挂载 Vue + Naive UI + Pinia + Router
│   ├── App.vue              # 根组件（providers + 导航 + 路由出口）
│   ├── router/index.js      # 路由表 + 登录守卫
│   ├── stores/              # Pinia：auth.js（登录态）、theme.js（主题）
│   ├── api/index.js         # fetch 封装 + uploadFile
│   ├── utils/               # format.js（时间/分类）、markdown.js（渲染）
│   ├── components/          # 可复用组件
│   │   ├── SiteHeader.vue   # 导航栏
│   │   ├── PostCard.vue     # 帖子卡片
│   │   ├── PostComposer.vue # 发帖表单
│   │   ├── CommentSection.vue
│   │   ├── PaginationBar.vue
│   │   └── FileUploadButton.vue  # 附件上传按钮
│   ├── views/               # 页面
│   │   ├── HomeView / LoginView / RegisterView
│   │   ├── NewsView（新闻，含国内/国外筛选）
│   │   ├── CategoryView（心得/学习通用列表）
│   │   ├── DailyView（日报 + 提交统计）
│   │   ├── PostView（帖子详情 + 点赞 + 编辑）
│   │   ├── AdminView（管理后台：统计/成员/排行）
│   │   ├── ReportView（周报/月报汇总）
│   │   └── TimelineView（时间线/里程碑）
│   └── styles/main.css      # 全站样式 + 深色/浅色主题变量
└── worker/                  # 后端源码
    ├── index.js             # Worker 入口：路由分发 + SPA 回退 + Cron
    ├── api.js               # 业务 API（约 700 行）
    └── news.js              # RSS 抓取 + Qwen 翻译
```

## 3. 环境搭建（本地开发）

前置要求：Node.js ≥ 20。

```bash
npm install            # 安装前端依赖
```

本地开发需要同时起「后端 Worker」和「前端 Vite」两个进程：

```bash
# 终端 1：后端 Worker（默认 8787 端口，需 npx 临时下载 wrangler）
npx wrangler dev

# 终端 2：前端（/api 已配好代理到 8787）
npm run dev
```

浏览器访问 http://localhost:5173 预览，数据与线上隔离。

> 注：`wrangler dev` 需要 Cloudflare 登录态（`npx wrangler login`）。远程/无浏览器环境下登录较麻烦，**日常开发可跳过本地后端，直接「改代码 → push → 线上验证」**，因为 Cloudflare 会自动构建部署，约 1 分钟生效。

## 4. 数据层

### D1 数据库（6 张表）

定义在 `schema.sql`，当前表：

| 表 | 用途 |
|---|---|
| `users` | 用户（第一个注册的自动是 admin） |
| `sessions` | 登录会话（30 天 Cookie） |
| `posts` | 帖子（category: news/insight/learn/daily） |
| `comments` | 评论 |
| `likes` | 点赞（user_id+post_id 复合主键） |
| `milestones` | 时间线/里程碑 |

**改表流程**：在 `schema.sql` 里用 `CREATE TABLE IF NOT EXISTS` 或 `ALTER TABLE` 加新表/新列 → push 代码 → 去 Cloudflare 控制台 D1 的 Console 里手动执行对应的 SQL（`CREATE TABLE IF NOT EXISTS` 是幂等的，可反复执行）。

### KV 存储（文件）

绑定名 `FILES`（见 `wrangler.toml`）。文件以「随机 id → 二进制内容 + metadata{文件名/类型/大小}」存储。新增文件存储直接复用 `/api/files` 接口即可，无需改表。

## 5. 如何修改后端（加 API 接口）

后端全部逻辑在 `worker/api.js`。加一个接口的步骤：

1. 写一个 handler 函数。例如加「获取所有里程碑」：

```js
async function handleListMilestones(request, env) {
  await requireUser(request, env);            // 需要登录
  const { results } = await env.DB.prepare(
    'SELECT * FROM milestones ORDER BY due_date ASC'
  ).all();
  return json({ milestones: results });
}
```

2. 在 `handleApi` 末尾的路由分发里注册。路由按 URL 分段匹配：

```js
export async function handleApi(request, env) {
  const seg = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  // /api/milestones → seg = ['milestones']
  // /api/milestones/3 → seg = ['milestones', '3']
  if (seg[0] === 'milestones' && method === 'GET') {
    return await handleListMilestones(request, env);
  }
}
```

### 常用的内置辅助函数（都在 api.js 里）

| 函数 | 作用 |
|---|---|
| `json(data, status)` | 返回 JSON Response |
| `fail(msg, status)` | 抛业务错误（被 catch 转成 JSON error） |
| `requireUser(request, env)` | 校验登录，返回当前用户 |
| `requireAdmin(request, env)` | 校验管理员 |
| `readJson(request)` | 读取并解析 JSON body |
| `currentUser(request, env)` | 静默获取当前用户（未登录返回 null） |
| `hashPassword / verifyPassword` | PBKDF2 密码 |
| `newToken()` | 生成随机 token（也用于文件 id） |

## 6. 如何修改前端（加页面）

### 加一个页面

1. 在 `src/views/` 新建 `XxxView.vue`。
2. 在 `src/router/index.js` 注册路由：

```js
{ path: '/xxx', name: 'xxx', component: () => import('../views/XxxView.vue') },
```

   如果是管理员专属，加 `meta: { requiresAdmin: true }`（守卫在 `router/index.js` 里自动跳转）。

3. 在 `src/components/SiteHeader.vue` 的导航里加 `<router-link to="/xxx">`（如需要导航入口）。

### 调后端接口

统一用 `src/api/index.js` 里的 `api` 对象：

```js
import { api } from '../api'

const data = await api.get('/milestones')            // GET
await api.post('/milestones', { title: 'xxx' })      // POST（JSON body）
await api.patch('/milestones/3', { status: 'done' }) // PATCH
await api.del('/milestones/3')                       // DELETE
await api.uploadFile(file)                           // 文件上传（FormData）
```

错误会抛 `ApiError`（带 `message`），在组件里 `try/catch` 后用 `message.error(e.message)` 提示即可。

### UI 组件

用的是 **Naive UI**（`n-button`、`n-input`、`n-form`、`n-modal`、`n-table`、`n-select`、`n-date-picker` 等）。提示用 `useMessage()`，确认框用 `useDialog()`：

```js
import { useMessage, useDialog } from 'naive-ui'
const message = useMessage()
const dialog = useDialog()

message.success('成功')
dialog.warning({ title: '提示', content: '确定吗？', positiveText: '确定', negativeText: '取消', onPositiveClick: async () => { ... } })
```

### Markdown 渲染

帖子/日报正文，以及任何要渲染 Markdown 的地方：

```vue
<script setup>
import { renderMarkdown } from '../utils/markdown'
</script>
<template>
  <div class="post-content" v-html="renderMarkdown(text)"></div>
</template>
```

`renderMarkdown` 内部已做 XSS 消毒，直接 `v-html` 安全。

## 7. 定时任务 / 新闻抓取 / AI 翻译

- **Cron**：在 `wrangler.toml` 的 `[triggers]` 里配，格式是标准 5 段 cron（UTC 时间）。
- **抓取入口**：`worker/index.js` 里的 `scheduled()` 调用 `worker/news.js` 的 `runNewsCrawler()`。
- **新闻源**：`worker/news.js` 顶部的 `FEEDS` 数组，加一个源就是加一条 `{ name, url, region }`（region: domestic/overseas）。
- **手动触发**：管理员登录后访问 `/api/crawl`（加 `?force=1` 可清空重抓）。
- **翻译**：`worker/news.js` 的 `translateText()` 用 Qwen 模型，只翻译 overseas 的源。

## 8. 部署与上线

### 日常部署（唯一需要记的）

```bash
git add -A
git commit -m "描述改动"
git push
```

Cloudflare 检测到 push 后自动 `npm install` + `npm run build` 再部署，约 1 分钟上线。

### 数据库变更要额外做一步

如果这次改动涉及**新表/新字段**，push 后还要去 Cloudflare 控制台 → D1 → lgame-db → Console 手动执行建表 SQL。否则接口会报「no such table」。

### 常见网络问题的处理

GitHub 直连经常超时。本机挂了代理时（clash 端口 7897），用：

```bash
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push
```

## 9. 重要注意事项

1. **提交前检查 `git status`**：仓库里可能会出现无关文件（如 `.claude/` 目录、临时日志），这些已被 `.gitignore` 排除，但提交前仍要扫一眼，别把不相干的东西提交进去。

2. **前端依赖版本不要盲目升级**：项目当前锁定了 `vue-router@4`、`pinia@2`（`vue-router@5`、`pinia@4` 是 breaking change 大版本，升级会导致路由异常）。升依赖前先确认 API 兼容。

3. **路由过渡动画是坑**：`App.vue` 的 `<router-view>` 目前**没有**包 `<transition mode="out-in">`（曾经加过会导致页面切换卡住、必须刷新）。不要再加 `mode="out-in"` 的过渡。

4. **News 页国内/国外筛选**：靠 `posts.meta` 里的 `region` 字段 + 列表接口的 `region` 参数实现，改动筛选逻辑时注意这两处要一致。

5. **Naive UI 组件是全局注册**的（`main.js` 里 `app.use(naive)`），所以模板里任何 `n-xxx` 组件都能直接用，无需 import；但 `useMessage` / `useDialog` 这类函数式 API 需要在组件 setup 里 import。

6. **依赖的 Cloudflare 资源**：D1 数据库（lgame-db）、KV 命名空间（lgame-files）、Workers AI。这些都在 `wrangler.toml` 里绑定，改动绑定时要保证控制台里的资源存在且 ID 正确。