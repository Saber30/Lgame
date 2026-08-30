# 更新日志（CHANGELOG）

## 2026-08-29 · V2.0 大版本更新

本次对 LGame 工作室网站做了一次全面升级：前端从「静态 HTML + 原生 JS」重构为 **Vue 3 单页应用**，并新增多项功能。

### 一、前端架构重构

- 8 个静态 HTML 页面 → **Vue 3 + Vite + Vue Router** 单页应用（9 条路由）
- 引入 **Element Plus** 组件库 + **Pinia** 状态管理
- 组件化拆分：导航栏、帖子卡片、发帖表单、评论、分页等独立组件
- 后端 API 逻辑零改动（仅迁移目录），接口照旧对接 `/api/*`

### 二、新增功能

| 功能 | 说明 |
|------|------|
| Markdown 排版 | 帖子正文支持 Markdown（标题、列表、代码块、链接、引用、图片外链），渲染后做 XSS 消毒 |
| 深色 / 浅色主题 | 导航栏右上角一键切换，偏好本地记忆 |
| 点赞 | 帖子详情页可点赞，列表卡片显示点赞数 |
| 帖子编辑 | 作者 / 管理员可在详情页编辑帖子（日报支持编辑三段式） |
| 管理员重置密码 | 管理后台一键重置成员密码（替代邮箱找回） |

### 三、游戏新闻自动抓取

- 定时任务（Cron）**每 2 小时**自动抓取 5 个游戏媒体 RSS：
  - 国内：机核、触乐
  - 国外：Gematsu、Rock Paper Shotgun、GameSpot
- 自动标记「国内 / 国外」，新闻页支持「全部 / 国内 / 国外」筛选
- 按原文链接去重，不会重复入库
- 管理员可手动触发：登录后访问 `/api/crawl`（加 `?force=1` 可清空重抓）

### 四、国外新闻自动翻译

- 国外源新闻的标题和摘要自动翻译成**简体中文**（Cloudflare Workers AI，Qwen 模型）
- 翻译失败时降级保留英文原文，不影响抓取

### 五、数据库变更

- 新增 `likes` 表（点赞）：
  ```sql
  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id)
  );
  ```
  在 D1 控制台执行一次即可（幂等，不影响已有数据）。

### 六、部署方式

- 前端构建产物 `dist/` 作为 Worker 静态资源，部署时自动 `npm run build`
- SPA 路由回退 + `/api` 后端共存于同一个 Worker
- 域名 `lgame.men` / `xianyu.lgame.men` 不变，`git push` 后自动部署

---

> 备注：图片上传功能因 Cloudflare R2 需绑定境外信用卡，暂缓；可用 Markdown 图片外链替代。
