// LGame 工作室 · Worker 入口
// 前端是 Vue 单页应用，构建产物在 dist/（由 [assets] 托管）；
// /api/* 交给 worker/api.js 处理，其余未命中静态资源的路径回退到 index.html（SPA 路由）

import { handleApi, currentUser } from './api.js';
import { runNewsCrawler } from './news.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 手动触发新闻抓取（管理员专用，方便首次立即抓取和调试）
    if (path === '/api/crawl') {
      return handleCrawl(request, env);
    }

    if (path === '/api' || path.startsWith('/api/')) {
      return handleApi(request, env);
    }

    // 能走到这里，说明 dist/ 里没有匹配的静态文件。
    // 带扩展名的按 404 处理；无扩展名的（/news、/post/3、/admin 等前端路由）回退到 index.html
    if (/\.[a-zA-Z0-9]+$/.test(path)) {
      return new Response('Not Found', { status: 404 });
    }
    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
  },

  // 定时任务：抓取游戏新闻（cron 在 wrangler.toml 的 [triggers] 里配置）
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runNewsCrawler(env));
  },
};

async function handleCrawl(request, env) {
  const user = await currentUser(request, env);
  if (!user || user.role !== 'admin') {
    return new Response(JSON.stringify({ error: '需要管理员权限' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  // force=1 时先清空所有新闻再重新抓取（用于重置/重新翻译旧数据）
  const url = new URL(request.url);
  if (url.searchParams.get('force') === '1') {
    await env.DB.prepare("DELETE FROM posts WHERE category = 'news'").run();
  }
  const result = await runNewsCrawler(env);
  return new Response(JSON.stringify({ ok: true, ...result }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
