// LGame 前端 API 层：封装 fetch，对接 Cloudflare Worker 的 /api/* 接口

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export const api = {
  async request(path, options = {}) {
    const opts = {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
    if (options.body !== undefined) opts.body = JSON.stringify(options.body)
    const res = await fetch('/api' + path, opts)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(data.error || '请求失败，请稍后再试', res.status)
    return data
  },
  get(path) {
    return this.request(path)
  },
  post(path, body) {
    return this.request(path, { method: 'POST', body })
  },
  patch(path, body) {
    return this.request(path, { method: 'PATCH', body })
  },
  del(path) {
    return this.request(path, { method: 'DELETE' })
  },
}
