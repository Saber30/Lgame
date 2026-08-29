// LGame 新闻自动抓取模块
// 定时（Cron）抓取游戏媒体 RSS，写入 posts 表（category='news'，自动标国内/国外）

const FEEDS = [
  { name: '机核', url: 'https://www.gcores.com/rss', region: 'domestic' },
  { name: '触乐', url: 'https://www.chuapp.com/feed', region: 'domestic' },
  { name: 'Gematsu', url: 'https://www.gematsu.com/feed', region: 'overseas' },
  { name: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed', region: 'overseas' },
  { name: 'GameSpot', url: 'https://www.gamespot.com/feeds/news/', region: 'overseas' },
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const MAX_PER_FEED = 10;

export async function runNewsCrawler(env) {
  const author = await env.DB.prepare("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").first();
  if (!author) return { added: 0, reason: '还没有用户，跳过抓取' };

  let added = 0;
  const errors = [];
  for (const feed of FEEDS) {
    try {
      const xml = await fetchFeed(feed);
      const items = parseRss(xml);
      for (const item of items.slice(0, MAX_PER_FEED)) {
        if (!item.title || !item.link) continue;
        const exists = await env.DB.prepare('SELECT id FROM posts WHERE link = ?').bind(item.link).first();
        if (exists) continue;

        let title = item.title;
        let description = item.description || '';
        if (feed.region === 'overseas') {
          title = await translateText(env, title, errors);
          description = await translateText(env, description, errors);
        }

        await env.DB.prepare(
          "INSERT INTO posts (user_id, category, title, content, link, meta, status) VALUES (?, 'news', ?, ?, ?, ?, 'approved')"
        )
          .bind(
            author.id,
            title.slice(0, 100),
            buildContent(feed, description, item.link),
            item.link,
            JSON.stringify({ source: feed.name, region: feed.region })
          )
          .run();
        added++;
      }
    } catch (e) {
      errors.push(`${feed.name}: ${e.message}`);
      console.error('feed failed:', feed.name, e.message);
    }
  }
  return { added, errors };
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.text();
}

function parseRss(xml) {
  const items = [];
  const itemRe = /<item[\s\S]*?<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    items.push({
      title: field(m[0], 'title'),
      link: field(m[0], 'link'),
      description: field(m[0], 'description'),
    });
  }
  return items;
}

function field(block, name) {
  let re;
  if (name === 'title') re = /<title[^>]*>([\s\S]*?)<\/title>/i;
  else if (name === 'link') re = /<link[^>]*>([\s\S]*?)<\/link>/i;
  else if (name === 'description') re = /<description[^>]*>([\s\S]*?)<\/description>/i;
  else return '';
  const m = block.match(re);
  return m ? clean(m[1]) : '';
}

function clean(s) {
  return stripHtml(decodeEntities(s));
}

function decodeEntities(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#\d+;/g, '')
    .replace(/&[a-zA-Z]+;/g, '');
}

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildContent(feed, description, link) {
  const excerpt = stripHtml(decodeEntities(description || '')).slice(0, 300);
  const footer = `来源：${feed.name} · 原文：${link}`;
  return excerpt ? `${excerpt}\n\n${footer}` : footer;
}

// 把英文文本翻译成简体中文（失败时返回原文兜底，并把错误记录进 errors 供排查）
async function translateText(env, text, errors) {
  const cleaned = stripHtml(decodeEntities(text || '')).trim();
  if (!cleaned || /[\u4e00-\u9fa5]/.test(cleaned)) return cleaned;
  if (!env.AI) {
    pushOnce(errors, 'env.AI 未定义（AI 绑定未生效）');
    return cleaned;
  }
  try {
    const res = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: cleaned.slice(0, 800),
      source_lang: 'english',
      target_lang: 'chinese',
    });
    return (res && res.translated_text) || cleaned;
  } catch (e) {
    pushOnce(errors, '翻译失败: ' + (e && e.message ? e.message : String(e)));
    return cleaned;
  }
}

function pushOnce(arr, msg) {
  if (Array.isArray(arr) && msg && !arr.includes(msg)) arr.push(msg);
}
