-- LGame 工作室 · 数据库表结构
-- 部署时：在 Cloudflare 控制台的 D1 数据库 -> Console 里粘贴执行本文件全部内容

-- 用户表（第一个注册的用户自动成为 admin）
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',  -- 'admin' | 'member'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 登录会话表（30 天有效期）
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 帖子表（四个分类共用）
-- category: news=游戏新闻, insight=游戏心得, learn=学习园地, daily=工作日报
-- meta: 仅日报使用，JSON 格式 {"done":"...","plan":"...","issues":"..."}
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('news','insight','learn','daily')),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  link TEXT,
  cover TEXT,                                -- 头图 URL（可为空）
  meta TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 点赞表（user_id + post_id 联合主键，防止重复点赞）
CREATE TABLE IF NOT EXISTS likes (
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, post_id)
);

-- 项目表（长期目标，里面包含一条阶段时间线）
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_date TEXT,                              -- 项目开始日期 'YYYY-MM-DD'
  end_date TEXT,                                -- 项目结束日期 'YYYY-MM-DD'
  status TEXT NOT NULL DEFAULT 'active',        -- 'active' | 'done'
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 阶段/里程碑表（项目时间线上的节点，短期任务）
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,                  -- 所属项目
  title TEXT NOT NULL,
  start_date TEXT,                              -- 开始日期 'YYYY-MM-DD'
  due_date TEXT NOT NULL,                       -- 截止日期 'YYYY-MM-DD'
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',       -- 'pending' | 'done'
  assignee_id INTEGER,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 时间线回复表（对项目或阶段的讨论）
CREATE TABLE IF NOT EXISTS replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,              -- 'project' | 'milestone'
  target_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_replies_target ON replies(target_type, target_id);
