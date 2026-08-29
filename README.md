# 🎮 LGame 工作室网站（lgame.men）

为独立游戏工作室打造的内部社区网站，代码托管在 GitHub，通过 Cloudflare Pages 自动部署。

**技术栈**：纯 HTML / CSS / JavaScript 前端（无需构建）+ Cloudflare Pages Functions 后端 + Cloudflare D1 数据库（SQLite）。全部功能都在 Cloudflare 免费额度内，无需付费。

## 功能一览

| 模块 | 说明 |
|------|------|
| 用户系统 | 注册 / 登录 / 退出，密码 PBKDF2 加密存储，30 天保持登录 |
| 游戏新闻 📰 | 分享行业动态：标题 + 原文链接 + 简介 |
| 游戏心得 🎮 | 记录玩过的游戏、感想与评价 |
| 学习园地 📚 | 学习笔记与知识沉淀 |
| 工作日报 📝 | 「今日完成 / 明日计划 / 遇到问题」三段式日报 |
| 评论 💬 | 所有帖子均可评论交流 |
| 管理后台 ⚙️ | 成员管理（设/撤管理员、删除成员）、帖子管理、数据统计 |

> **第一个注册的用户会自动成为管理员。**

## 目录结构

```
lgame/
├── public/               # 前端静态文件（Pages 部署目录）
│   ├── index.html        # 首页
│   ├── login.html        # 登录
│   ├── register.html     # 注册
│   ├── news.html         # 游戏新闻
│   ├── insight.html      # 游戏心得
│   ├── learn.html        # 学习园地
│   ├── daily.html        # 工作日报
│   ├── post.html         # 帖子详情 + 评论
│   ├── admin.html        # 管理后台
│   ├── css/style.css     # 全站样式
│   └── js/common.js      # 公共脚本（API 封装、登录态、通用渲染）
├── functions/
│   └── api/[[route]].js  # 后端 API（处理所有 /api/* 请求）
├── schema.sql            # 数据库表结构（部署时在 D1 控制台执行）
├── wrangler.toml.example # 本地开发配置模板（可选，不影响线上）
└── README.md
```

## 部署步骤（从零到上线，约 20 分钟）

### 第 0 步：准备

- ✅ Cloudflare 账号（域名 lgame.men 已接入 Cloudflare）
- ✅ GitHub 账号
- ✅ 本项目代码

### 第 1 步：把代码推送到 GitHub

1. 打开 [github.com](https://github.com)，右上角 **+** → **New repository**
2. 名称填 `lgame`，Public / Private 均可 → **Create repository**
3. 在本项目文件夹打开终端（Git Bash），把 `你的用户名` 替换成你的 GitHub 用户名后执行：

```bash
git init -b main
git remote add origin https://github.com/你的用户名/lgame.git
git add -A
git commit -m "init: LGame 工作室网站"
git push -u origin main
```

### 第 2 步：创建 D1 数据库

1. 登录 [dash.cloudflare.com](https://dash.cloudflare.com)
2. 左侧菜单 **Storage & Databases（存储和数据库）** → **D1 SQL Database** → **Create database**
3. 数据库名称填 `lgame-db` → 创建
4. 进入数据库页面，切到 **Console（控制台）** 标签
5. 打开本项目的 `schema.sql`，**复制全部内容**粘贴进 Console，点 **Execute（执行）**
6. 执行成功后数据库里会有 4 张表：users / sessions / posts / comments

### 第 3 步：创建 Pages 项目（连接 GitHub 自动部署）

1. 左侧菜单 **Compute (Workers & Pages)** → **Create** → 切到 **Pages** 标签 → **Connect to Git**
2. 授权 GitHub，选择 `lgame` 仓库 → **Begin setup**
3. 构建设置：
   - **Framework preset**：`None`
   - **Build command**：留空
   - **Build output directory**：`public`
4. 点 **Save and Deploy**，等待约 1 分钟部署完成
5. 此时网站有临时地址（形如 `lgame-xxxx.pages.dev`），可以先点开看看

### 第 4 步：绑定数据库（关键！）

1. 进入刚创建的 Pages 项目 → **Settings（设置）** → **Bindings（绑定）**
2. 点 **Add（添加）** → 选 **D1 database**：
   - **Variable name（变量名称）**：`DB` ← 必须叫这个名字，代码里用的就是它
   - **D1 database**：选择刚建的 `lgame-db`
3. 保存后，进入 **Deployments（部署）** 页面，点最新一条部署右侧的 `⋯` → **Retry deployment**

> 绑定数据库后必须重新部署一次，否则所有 API 都会报「服务器内部错误」。

### 第 5 步：绑定域名 lgame.men

1. Pages 项目 → **Custom domains（自定义域）** → **Set up a custom domain**
2. 输入 `lgame.men` → 按提示 **Continue / Activate**
3. 域名就在同一个 Cloudflare 账号里，DNS 记录会自动配置，几分钟内生效
4. （可选）再添加 `www.lgame.men`

### 第 6 步：注册第一个账号

打开 `https://lgame.men/register.html` 注册——**第一个注册的用户自动成为管理员**。
之后把网址发给工作室成员，大家自行注册即可。

## 日常使用：改代码 → 自动上线

网站和 GitHub 仓库是联动的，以后想改任何东西（文字、样式、功能），改完执行：

```bash
git add -A
git commit -m "描述一下改了什么"
git push
```

推送后约 1 分钟 Cloudflare 自动部署新版本，无需任何手动操作。

## 常见问题

**Q：网页能打开，但登录/发帖都报「服务器内部错误」？**
A：99% 是第 4 步的 D1 绑定没做，或绑定后忘了 Retry deployment。

**Q：忘记密码怎么办？**
A：目前没有邮箱找回功能。请管理员在「管理」页面删除该账号，让对方重新注册。

**Q：怎么增加管理员？**
A：管理员登录后进入「管理」页面，在成员管理里点「设为管理员」。

**Q：想先在本地跑起来预览？**（可选，需要 Node.js）
A：把 `wrangler.toml.example` 复制为 `wrangler.toml`，填入你的 database_id（在 D1 数据库页面可查），然后：

```bash
npx wrangler d1 execute lgame-db --local --file=schema.sql
npx wrangler pages dev public
```

访问 http://localhost:8788 即可。
