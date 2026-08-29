// LGame 工作室 · Worker 入口
// 静态文件（public/ 目录）由 Workers 静态资源直接托管；
// /api/* 的请求会进入这里，交给 src/api.js 处理

import { handleApi } from './api.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }
    // 没有匹配到静态资源、也不是 API 的路径
    return new Response('Not Found', { status: 404 });
  },
};
