// LGame 工作室 · Worker 入口
// 前端是 Vue 单页应用，构建产物在 dist/（由 [assets] 托管）；
// /api/* 交给 worker/api.js 处理，其余未命中静态资源的路径回退到 index.html（SPA 路由）

import { handleApi } from './api.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

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
};
