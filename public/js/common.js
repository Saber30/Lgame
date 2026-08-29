// LGame 工作室 · 公共脚本：API 请求封装、登录状态、导航栏、通用渲染

const CATEGORY = {
  news: { label: '游戏新闻', href: '/news.html', emoji: '📰' },
  insight: { label: '游戏心得', href: '/insight.html', emoji: '🎮' },
  learn: { label: '学习园地', href: '/learn.html', emoji: '📚' },
  daily: { label: '工作日报', href: '/daily.html', emoji: '📝' },
};

let currentUser = null;

const API = {
  async request(path, options = {}) {
    const opts = { method: options.method || 'GET', headers: { 'Content-Type': 'application/json' } };
    if (options.body !== undefined) opts.body = JSON.stringify(options.body);
    const res = await fetch('/api' + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '请求失败，请稍后再试');
    return data;
  },
  get(path) {
    return this.request(path);
  },
  post(path, body) {
    return this.request(path, { method: 'POST', body });
  },
  patch(path, body) {
    return this.request(path, { method: 'PATCH', body });
  },
  del(path) {
    return this.request(path, { method: 'DELETE' });
  },
};

// 加载当前登录用户并刷新导航栏
async function loadCurrentUser() {
  try {
    const data = await API.get('/me');
    currentUser = data.user;
  } catch {
    currentUser = null;
  }
  updateNav();
  return currentUser;
}

function updateNav() {
  const el = document.getElementById('nav-auth');
  if (!el) return;
  if (currentUser) {
    el.innerHTML = `
      <span class="nav-username">👋 ${escapeHtml(currentUser.username)}</span>
      ${currentUser.role === 'admin' ? '<a href="/admin.html">管理</a>' : ''}
      <a href="#" id="logout-link">退出</a>`;
    el.querySelector('#logout-link').addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await API.post('/logout');
      } catch {}
      location.href = '/';
    });
  } else {
    el.innerHTML =
      '<a href="/login.html">登录</a><a href="/register.html" class="btn btn-primary btn-sm">注册</a>';
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// SQLite 的 datetime('now') 存的是 UTC 的 "YYYY-MM-DD HH:MM:SS"
function parseTime(sqliteTime) {
  return new Date(String(sqliteTime).replace(' ', 'T') + 'Z');
}

function timeAgo(sqliteTime) {
  const diff = (Date.now() - parseTime(sqliteTime).getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 86400 * 30) return Math.floor(diff / 86400) + ' 天前';
  return parseTime(sqliteTime).toLocaleDateString('zh-CN');
}

function fmtTime(sqliteTime) {
  return parseTime(sqliteTime).toLocaleString('zh-CN', { hour12: false });
}

function fmtDate(sqliteTime) {
  return parseTime(sqliteTime).toLocaleDateString('zh-CN');
}

function categoryBadge(cat) {
  const c = CATEGORY[cat] || { label: cat, href: '#' };
  return `<a class="badge badge-${cat}" href="${c.href}">${c.label}</a>`;
}

// 帖子卡片（全站列表通用）
function postCardHtml(p) {
  let extra = '';
  if (p.category === 'daily') {
    let done = '';
    try {
      done = JSON.parse(p.meta || '{}').done || '';
    } catch {}
    extra = done ? `<p class="post-excerpt">${escapeHtml(done.slice(0, 120))}</p>` : '';
  } else {
    extra = `<p class="post-excerpt">${escapeHtml((p.content || '').slice(0, 150))}</p>`;
    if (p.link) extra += '<span class="source-hint">🔗 附原文链接</span>';
  }
  return `
  <article class="post-card" data-id="${p.id}">
    <div class="post-meta">
      ${categoryBadge(p.category)}
      <span class="post-author">${escapeHtml(p.author_name)}</span>
      <span class="post-time">${timeAgo(p.created_at)}</span>
    </div>
    <h3 class="post-title">${escapeHtml(p.title)}</h3>
    ${extra}
  </article>`;
}

// 点击卡片跳转详情页（卡片内部的原生链接不拦截）
function enableCardNav(rootEl) {
  rootEl.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const card = e.target.closest('.post-card');
    if (card) location.href = '/post.html?id=' + card.dataset.id;
  });
}

// 轻量提示条
function toast(msg, ok = true) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('toast-error', !ok);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}
