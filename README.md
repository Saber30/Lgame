# 🎮 LGame 工作室网站（lgame.men）

为独立游戏工作室打造的内部社区网站，代码托管在 GitHub，通过 Cloudflare Workers 自动构建部署。

**技术栈**：Vue 3 + Vite + Vue Router + Pinia + Element Plus（前端 SPA）+ Cloudflare Workers（后端 API + 静态资源托管）+ Cloudflare D1 数据库（SQLite）。全部功能都在 Cloudflare 免费额度内，无需付费。

## 功能一览

| 模块 | 说明 |
|------|------|
| 用户系统 | 注册 / 登录 / 退出，密码 PBKDF2 加密存储，30 天保持登录 |
| 游戏新闻 📰 | 分享行业动态：标题 + 原文链接 + 简介 |
| 游戏心得 🎮 | 记录玩过的游戏、感想与评价 |
| 学习园地 📚 | 学习笔记与知识沉淀 |
| 工作日报 📝 | 「今日完成 / 明日计划 / 遇到问题」三段式日报 |
| 评论 💬 | 所有帖子均可评论交流 |
| Markdown ✍️ | 帖子正文支持 Markdown 排版（渲染后做 XSS 消毒） |
| 管理后台 ⚙️ | 成员管理（设/撤管理员、删除成员）、帖子管理、数据统计 |

> **第一个注册的用户会自动成为管理员。**

## 目录结构

```
lgame/
├── index.html            # Vite 入口（SPA 壳）
├── vite.config.js        # Vite 配置（含 /api 开发代理）
├── package.json          # 前端依赖与构建脚本
├── src/                  # Vue 前端源码
│   ├── main.js           # 应用入口：挂载 Vue + Element Plus + Router + Pinia
│   ├── App.vue           # 根组件（导航栏 + 路由出口 + 页脚）
│   ├── router/           # 路由表与登录守卫
│   ├── stores/           # Pinia 状态（登录态）
│   ├── api/              # fetch 封装，对接 /api/*
│   ├── utils/            # 时间格式化、Markdown 渲染等工具
│   ├── components/       # 导航栏、帖子卡片、发帖表单、评论、分页
│   ├── views/            # 各页面：首页/登录/注册/分类列表/日报/详情/管理后台
│   └── styles/           # 全站样式 + Element Plus 深色主题
├── worker/               # 后端（Cloudflare Worker）
│   ├── index.js          # 入口：/api/* 转 API，其余回退到 index.html（SPA）
│   └── api.js            # 后端 API（注册/登录/帖子/评论/管理员）
├── schema.sql            # 数据库表结构（在 D1 控制台执行一次即可）
├── wrangler.toml         # Workers 部署配置（含 D1 绑定与构建命令）
└── README.md
```

## 部署步骤

### 第 1 步：创建 D1 数据库并初始化

1. 登录 [dash.cloudflare.com](https://dash.cloudflare.com)
2. 左侧菜单 **Storage & Databases（存储和数据库）** → **D1 SQL Database** → **Create database**
3. 数据库名称填 `lgame-db` → 创建
4. 进入数据库页面 → **Console（控制台）** 标签 → 把 `schema.sql` 的全部内容粘贴进去 → **Execute（执行）**
5. 在数据库的 **概览页** 找到 **Database ID**（一串 UUID），后面第 2 步要用

### 第 2 步：填写 database_id

打开仓库根目录的 `wrangler.toml`，把 `database_id` 那一行的值替换成上一步复制的 Database ID。这一步不能省，否则后端连不上数据库。

### 第 3 步：创建 Worker 并连接 GitHub

1. 左侧菜单 **Compute (Workers & Pages)** → **Create** → **Import a Git repository（导入 Git 仓库）**
2. 授权 GitHub，选择 `Lgame` 仓库
3. 构建设置保持默认即可——Cloudflare 会读取 `wrangler.toml` 里的 `[build] command = "npm run build"`，**每次部署自动执行 `npm install` 和前端构建**
4. 点 **Deploy**，等待部署完成，会得到一个 `xxx.workers.dev` 的临时网址

> 已经创建过 Worker 的：进入该 Worker → **Settings → Build**，确认连接了 GitHub 仓库；之后每次 `git push` 会自动重新构建部署。

### 第 4 步：绑定域名 lgame.men

1. Worker 项目 → **Settings（设置）** → **Domains & Routes（域和路由）**
2. **Add（添加）** → **Custom domain（自定义域）** → 输入 `lgame.men`
3. 域名在同一个 Cloudflare 账号里，DNS 会自动配置，几分钟生效
4. （可选）再添加 `www.lgame.men`

### 第 5 步：注册第一个账号

打开网站 `/register` 注册——**第一个注册的用户自动成为管理员**。之后把网址发给工作室成员，大家自行注册即可。

## 日常使用：改代码 → 自动上线

```bash
git add -A
git commit -m "描述一下改了什么"
git push
```

推送后约 1 分钟 Cloudflare 自动构建并部署新版本（前端会先 `npm run build` 打包）。

## 本地开发（需要 Node.js）

```bash
npm install                  # 安装前端依赖（首次）
npx wrangler d1 execute lgame-db --local --file=schema.sql   # 初始化本地数据库（首次）
```

然后开两个终端：

```bash
# 终端 1：启动后端 Worker（默认 8787 端口）
npx wrangler dev

# 终端 2：启动前端开发服务器（/api 会自动代理到 8787）
npm run dev
```

浏览器访问 http://localhost:5173 预览，本地数据与线上互不影响。

## 常见问题

**Q：页面能打开，但注册/登录报「请求失败」或「服务器内部错误」？**
A：说明线上跑的还是旧版本，或 D1 绑定没生效。检查 `wrangler.toml` 里的 `database_id` 是否为真实值，推送后等 1-2 分钟部署完成，或手动点一次部署。

**Q：部署时构建失败？**
A：确认仓库根目录有 `package.json`、`wrangler.toml`，且 `wrangler.toml` 的 `[build] command` 是 `npm run build`。构建失败通常会在 Cloudflare 部署日志里给出具体报错。

**Q：访问 `/news` 等页面提示 Not Found？**
A：SPA 路由由 Worker 回退到 `index.html` 实现。确认线上 Worker 脚本是 `worker/index.js`（`wrangler.toml` 的 `main` 字段），且构建产物 `dist/` 已正常生成。

**Q：忘记密码怎么办？**
A：目前没有邮箱找回功能。请管理员在「管理」页面删除该账号，让对方重新注册。

**Q：怎么增加管理员？**
A：管理员登录后进入「管理」页面，在成员管理里点「设为管理员」。

**Q：帖子内容能排版吗？**
A：能。帖子正文支持 Markdown 语法（标题、列表、代码块、链接、引用、图片等），渲染时会做安全过滤，无法注入恶意脚本。
