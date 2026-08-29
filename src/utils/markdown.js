import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  html: false, // 不渲染原始 HTML，降低 XSS 风险
  linkify: true,
  breaks: true,
})

// 帖子正文 Markdown -> 安全 HTML（先由 markdown-it 渲染，再用 DOMPurify 消毒）
export function renderMarkdown(text) {
  if (!text) return ''
  const html = md.render(String(text))
  return DOMPurify.sanitize(html)
}
