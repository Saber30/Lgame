// LGame 工作室 · 后端 API
// 运行在 Cloudflare Workers 上，数据库为 D1 (SQLite)
// 本文件导出 handleApi(request, env)，由 worker/index.js 在 /api/* 路径下调用

const ITERATIONS = 100000; // PBKDF2 迭代次数
const SESSION_MAX_AGE = 30 * 24 * 3600; // 会话有效期 30 天（秒）
const VALID_CATEGORIES = ['news', 'insight', 'learn', 'daily'];

class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function fail(message, status = 400) {
  throw new HttpError(message, status);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

async function readJson(request) {
  try {
    return (await request.json()) || {};
  } catch {
    return {};
  }
}

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// PBKDF2 哈希，存储格式：盐(hex).哈希(hex)
async function hashPassword(password, salt) {
  if (!salt) salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256
  );
  return hex(salt) + '.' + hex(bits);
}

async function verifyPassword(password, stored) {
  const [saltHex] = String(stored).split('.');
  if (!saltHex || !/^[0-9a-f]{32}$/.test(saltHex)) return false;
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const computed = await hashPassword(password, salt);
  return computed === stored;
}

function newToken() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

function sessionCookie(token, maxAge) {
  return `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

// 从 Cookie 解析当前登录用户（未登录返回 null）
async function currentUser(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)session=([0-9a-f]{64})/);
  if (!m) return null;
  const user = await env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')`
  )
    .bind(m[1])
    .first();
  return user || null;
}

async function requireUser(request, env) {
  const user = await currentUser(request, env);
  if (!user) fail('请先登录', 401);
  return user;
}

async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  if (user.role !== 'admin') fail('需要管理员权限', 403);
  return user;
}

function publicUser(u) {
  return { id: u.id, username: u.username, email: u.email, role: u.role };
}

async function createSession(env, userId) {
  const token = newToken();
  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))`
  )
    .bind(token, userId)
    .run();
  return token;
}

// ---------------- 业务处理 ----------------

async function handleRegister(request, env) {
  const body = await readJson(request);
  const username = String(body.username || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (username.length < 2 || username.length > 20) fail('用户名长度需为 2-20 个字符');
  if (!/^[\w\u4e00-\u9fa5-]+$/.test(username)) fail('用户名只能包含中文、字母、数字、下划线、连字符');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('邮箱格式不正确');
  if (password.length < 6) fail('密码至少需要 6 位');
  if (password.length > 72) fail('密码过长');

  const exists = await env.DB.prepare(
    'SELECT username, email FROM users WHERE LOWER(username) = ? OR email = ?'
  )
    .bind(username.toLowerCase(), email)
    .all();
  for (const row of exists.results) {
    if (row.username.toLowerCase() === username.toLowerCase()) fail('用户名已被注册');
    if (row.email === email) fail('邮箱已被注册');
  }

  const passwordHash = await hashPassword(password);
  // 第一个注册的用户自动成为管理员
  const { c } = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first();
  const role = c === 0 ? 'admin' : 'member';

  const insert = await env.DB.prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
  )
    .bind(username, email, passwordHash, role)
    .run();

  const token = await createSession(env, insert.meta.last_row_id);
  return json(
    {
      user: { id: insert.meta.last_row_id, username, email, role },
      message: role === 'admin' ? '注册成功，你是第一位用户，已自动成为管理员' : '注册成功',
    },
    201,
    { 'Set-Cookie': sessionCookie(token, SESSION_MAX_AGE) }
  );
}

async function handleLogin(request, env) {
  const body = await readJson(request);
  const account = String(body.account || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!account || !password) fail('请输入账号和密码');

  const user = await env.DB.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR email = ?')
    .bind(account, account)
    .first();
  if (!user || !(await verifyPassword(password, user.password_hash))) fail('账号或密码错误', 401);

  const token = await createSession(env, user.id);
  // 顺手清理已过期的会话
  await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
  return json({ user: publicUser(user) }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_MAX_AGE) });
}

async function handleLogout(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)session=([0-9a-f]{64})/);
  if (m) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(m[1]).run();
  return json({ ok: true }, 200, {
    'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  });
}

async function handleListPosts(url, env) {
  const category = url.searchParams.get('category');
  if (category && !VALID_CATEGORIES.includes(category)) fail('分类不正确');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '10', 10) || 10));

  const where = category ? "WHERE p.category = ? AND p.status = 'approved'" : "WHERE p.status = 'approved'";
  const args = category ? [category] : [];

  const { results } = await env.DB.prepare(
    `SELECT p.id, p.user_id AS author_id, p.category, p.title, p.content, p.link, p.meta, p.created_at,
            u.username AS author_name
       FROM posts p JOIN users u ON u.id = p.user_id
      ${where}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?`
  )
    .bind(...args, pageSize, (page - 1) * pageSize)
    .all();

  const { total } = await env.DB.prepare(`SELECT COUNT(*) AS total FROM posts p ${where}`)
    .bind(...args)
    .first();

  return json({ posts: results, total, page, pageSize });
}

async function handleCreatePost(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const category = String(body.category || '');
  if (!VALID_CATEGORIES.includes(category)) fail('分类不正确');

  let title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  let link = null;
  let meta = null;

  if (category === 'daily') {
    const done = String(body.done || '').trim();
    const plan = String(body.plan || '').trim();
    const issues = String(body.issues || '').trim();
    if (!done && !plan && !issues) fail('日报内容不能为空');
    if (!title) {
      const now = new Date();
      title = `${now.getUTCMonth() + 1}月${now.getUTCDate()}日 日报`;
    }
    meta = JSON.stringify({ done, plan, issues });
  } else {
    if (!title) fail('标题不能为空');
    if (!content) fail('内容不能为空');
  }
  if (title.length > 100) fail('标题不能超过 100 字');
  if (content.length > 10000) fail('内容不能超过 10000 字');

  if (category === 'news' && body.link) {
    link = String(body.link).trim();
    if (!/^https?:\/\//i.test(link)) fail('链接必须以 http:// 或 https:// 开头');
    if (link.length > 500) fail('链接过长');
  }

  const insert = await env.DB.prepare(
    'INSERT INTO posts (user_id, category, title, content, link, meta) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(user.id, category, title, content, link, meta)
    .run();
  return json({ id: insert.meta.last_row_id, message: '发布成功' }, 201);
}

async function handleGetPost(env, request, id) {
  const post = await env.DB.prepare(
    `SELECT p.id, p.user_id AS author_id, p.category, p.title, p.content, p.link, p.meta, p.status, p.created_at,
            u.username AS author_name
       FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.id = ?`
  )
    .bind(id)
    .first();
  if (!post || post.status !== 'approved') fail('帖子不存在', 404);

  const { results } = await env.DB.prepare(
    `SELECT c.id, c.content, c.created_at, c.user_id AS author_id, u.username AS author_name
       FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC, c.id ASC`
  )
    .bind(id)
    .all();

  const user = await currentUser(request, env);
  const canDelete = !!user && (user.id === post.author_id || user.role === 'admin');
  return json({ post, comments: results, canDelete });
}

async function handleDeletePost(env, request, id) {
  const user = await requireUser(request, env);
  const post = await env.DB.prepare('SELECT id, user_id FROM posts WHERE id = ?').bind(id).first();
  if (!post) fail('帖子不存在', 404);
  if (user.id !== post.user_id && user.role !== 'admin') fail('没有权限删除这篇帖子', 403);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM comments WHERE post_id = ?').bind(id),
    env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}

async function handleAddComment(request, env, postId) {
  const user = await requireUser(request, env);
  const post = await env.DB.prepare(`SELECT id FROM posts WHERE id = ? AND status = 'approved'`)
    .bind(postId)
    .first();
  if (!post) fail('帖子不存在', 404);

  const body = await readJson(request);
  const content = String(body.content || '').trim();
  if (!content) fail('评论不能为空');
  if (content.length > 2000) fail('评论不能超过 2000 字');

  const insert = await env.DB.prepare(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)'
  )
    .bind(postId, user.id, content)
    .run();
  return json({ id: insert.meta.last_row_id, message: '评论成功' }, 201);
}

async function handleListUsers(request, env) {
  await requireAdmin(request, env);
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.username, u.email, u.role, u.created_at,
            (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS post_count,
            (SELECT COUNT(*) FROM comments WHERE user_id = u.id) AS comment_count
       FROM users u
      ORDER BY u.id ASC`
  ).all();
  return json({ users: results });
}

async function handleUpdateUser(request, env, id) {
  const admin = await requireAdmin(request, env);
  if (!Number.isInteger(id)) fail('参数错误');
  if (id === admin.id) fail('不能修改自己的角色');
  const body = await readJson(request);
  if (body.role !== 'admin' && body.role !== 'member') fail('角色只能是 admin 或 member');
  const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!target) fail('用户不存在', 404);
  await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(body.role, id).run();
  return json({ ok: true });
}

async function handleDeleteUser(request, env, id) {
  const admin = await requireAdmin(request, env);
  if (!Number.isInteger(id)) fail('参数错误');
  if (id === admin.id) fail('不能删除自己');
  const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!target) fail('用户不存在', 404);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM comments WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM posts WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}

async function handleStats(request, env) {
  await requireAdmin(request, env);
  const { c: users } = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first();
  const { c: comments } = await env.DB.prepare('SELECT COUNT(*) AS c FROM comments').first();
  const { results } = await env.DB.prepare('SELECT category, COUNT(*) AS c FROM posts GROUP BY category').all();
  const posts = { news: 0, insight: 0, learn: 0, daily: 0 };
  for (const row of results) posts[row.category] = row.c;
  return json({
    users,
    comments,
    posts,
    totalPosts: Object.values(posts).reduce((a, b) => a + b, 0),
  });
}

// ---------------- 路由分发 ----------------
// 按路径分发：/api/posts/3/comments -> ['posts', '3', 'comments']

export async function handleApi(request, env) {
  const method = request.method;
  const url = new URL(request.url);
  const seg = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);

  try {
    if (seg.length === 1) {
      if (seg[0] === 'register' && method === 'POST') return await handleRegister(request, env);
      if (seg[0] === 'login' && method === 'POST') return await handleLogin(request, env);
      if (seg[0] === 'logout' && method === 'POST') return await handleLogout(request, env);
      if (seg[0] === 'me' && method === 'GET') {
        const user = await currentUser(request, env);
        return json({ user: user ? publicUser(user) : null });
      }
      if (seg[0] === 'stats' && method === 'GET') return await handleStats(request, env);
      if (seg[0] === 'posts') {
        if (method === 'GET') return await handleListPosts(url, env);
        if (method === 'POST') return await handleCreatePost(request, env);
      }
      if (seg[0] === 'users' && method === 'GET') return await handleListUsers(request, env);
    }

    if (seg[0] === 'posts' && seg.length === 2) {
      const id = Number(seg[1]);
      if (!Number.isInteger(id)) fail('参数错误');
      if (method === 'GET') return await handleGetPost(env, request, id);
      if (method === 'DELETE') return await handleDeletePost(env, request, id);
    }

    if (seg[0] === 'posts' && seg.length === 3 && seg[2] === 'comments' && method === 'POST') {
      const id = Number(seg[1]);
      if (!Number.isInteger(id)) fail('参数错误');
      return await handleAddComment(request, env, id);
    }

    if (seg[0] === 'users' && seg.length === 2) {
      const id = Number(seg[1]);
      if (!Number.isInteger(id)) fail('参数错误');
      if (method === 'PATCH') return await handleUpdateUser(request, env, id);
      if (method === 'DELETE') return await handleDeleteUser(request, env, id);
    }

    return json({ error: '接口不存在' }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('API error:', e);
    return json({ error: '服务器内部错误，请稍后再试' }, 500);
  }
}
