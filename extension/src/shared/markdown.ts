import { Marked } from 'marked'
import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const marked = new Marked({
  gfm: true,
  breaks: true,
})

marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const label = (lang || 'code').replace(/[^\w+-]/g, '') || 'code'
      const body = escapeHtml(text.replace(/\n$/, ''))
      return `<div class="md-code"><div class="md-code__bar"><span class="md-code__lang">${escapeHtml(label)}</span><button type="button" class="md-code__copy" data-md-copy>复制</button></div><pre class="md-code__pre"><code>${body}</code></pre></div>`
    },
    codespan({ text }: { text: string }) {
      return `<code class="md-inline-code">${escapeHtml(text)}</code>`
    },
    link({ href, title, text }: { href: string; title?: string | null; text: string }) {
      const t = title ? ` title="${escapeHtml(title)}"` : ''
      const safeHref = escapeHtml(href || '')
      return `<a href="${safeHref}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`
    },
  },
})

const PURIFY: DomPurifyConfig = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ['button'],
  ADD_ATTR: ['target', 'rel', 'data-md-copy', 'type', 'class'],
  RETURN_TRUSTED_TYPE: false,
}

/** 将助手 Markdown 转为可安全注入的 HTML（对齐桌面智能会话） */
export function renderMarkdown(content: string): string {
  const raw = typeof content === 'string' ? content : String(content ?? '')
  if (!raw.trim()) return ''
  try {
    let html = marked.parse(raw, { async: false }) as string
    html = html
      .replace(/<table>/g, '<div class="md-table-wrap"><table>')
      .replace(/<\/table>/g, '</table></div>')
    return String(DOMPurify.sanitize(html, PURIFY))
  } catch (e) {
    console.error('[markdown]', e)
    return `<pre class="md-content__plain">${escapeHtml(raw)}</pre>`
  }
}
