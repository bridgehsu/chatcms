/** 页面媒体候选（仅 URL，不下载） */

export type PageMediaKind = 'image' | 'video'
export type PageMediaSource = 'og' | 'article-img' | 'video'

export interface PageMedia {
  id: string
  kind: PageMediaKind
  url: string
  poster?: string
  alt?: string
  source: PageMediaSource
  /** 建议预选（og / 正文大图） */
  preferred?: boolean
}

export const MAX_PAGE_IMAGES = 12
export const MAX_PAGE_VIDEOS = 3

function absUrl(raw: string | null | undefined, base: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s || s.startsWith('data:') || s.startsWith('blob:')) return null
  try {
    return new URL(s, base).href
  } catch {
    return null
  }
}

function pickFromSrcset(srcset: string | null | undefined, base: string): string | null {
  if (!srcset?.trim()) return null
  let best: { url: string; w: number } | null = null
  for (const part of srcset.split(',')) {
    const bits = part.trim().split(/\s+/)
    const u = absUrl(bits[0], base)
    if (!u) continue
    const desc = bits[1] || ''
    const w = desc.endsWith('w') ? parseInt(desc, 10) || 0 : 0
    if (!best || w >= best.w) best = { url: u, w }
  }
  return best?.url ?? null
}

function isTinyOrIcon(el: HTMLImageElement, url: string): boolean {
  const w = el.naturalWidth || el.width || 0
  const h = el.naturalHeight || el.height || 0
  if ((w > 0 && w < 120) || (h > 0 && h < 120)) return true
  const lower = url.toLowerCase()
  if (
    /favicon|sprite|icon[-_/]|logo[-_/]|avatar|emoji|tracking|1x1|pixel\./.test(
      lower,
    )
  ) {
    return true
  }
  return false
}

/**
 * 在页面 DOM 中抽取媒体候选。content script 与 executeScript 注入均可调用
 *（注入路径需把本函数逻辑内联到自包含函数中）。
 */
export function extractPageMedia(doc: Document = document): PageMedia[] {
  const base = doc.baseURI || location.href
  const images: PageMedia[] = []
  const videos: PageMedia[] = []
  const seen = new Set<string>()

  const pushImage = (
    url: string | null,
    source: PageMediaSource,
    opts?: { alt?: string; preferred?: boolean },
  ) => {
    if (!url || seen.has(url) || images.length >= MAX_PAGE_IMAGES) return
    seen.add(url)
    images.push({
      id: `img-${images.length + 1}`,
      kind: 'image',
      url,
      alt: opts?.alt,
      source,
      preferred: opts?.preferred,
    })
  }

  const pushVideo = (
    url: string | null,
    opts?: { poster?: string },
  ) => {
    if (!url || seen.has(url) || videos.length >= MAX_PAGE_VIDEOS) return
    const lower = url.toLowerCase()
    if (lower.includes('.m3u8')) return
    seen.add(url)
    videos.push({
      id: `vid-${videos.length + 1}`,
      kind: 'video',
      url,
      poster: opts?.poster,
      source: 'video',
    })
  }

  // og:image
  const ogImage =
    doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content')
  pushImage(absUrl(ogImage, base), 'og', { preferred: true })

  const ogVideo =
    doc.querySelector('meta[property="og:video"]')?.getAttribute('content') ||
    doc
      .querySelector('meta[property="og:video:url"]')
      ?.getAttribute('content')
  pushVideo(absUrl(ogVideo, base))

  const root =
    doc.querySelector('article') ||
    doc.querySelector('main') ||
    doc.querySelector('[role="main"]') ||
    doc.body

  if (root) {
    const imgs = Array.from(root.querySelectorAll('img'))
    for (const img of imgs) {
      if (images.length >= MAX_PAGE_IMAGES) break
      const fromSrcset = pickFromSrcset(img.getAttribute('srcset'), base)
      const url =
        fromSrcset ||
        absUrl(img.currentSrc || img.getAttribute('src'), base)
      if (!url) continue
      if (isTinyOrIcon(img, url)) continue
      const w = img.naturalWidth || img.width || 0
      const preferred = w >= 400 || images.filter((i) => i.preferred).length < 3
      pushImage(url, 'article-img', {
        alt: img.getAttribute('alt') || undefined,
        preferred: preferred && images.filter((i) => i.preferred).length < 3,
      })
    }

    for (const video of Array.from(root.querySelectorAll('video'))) {
      if (videos.length >= MAX_PAGE_VIDEOS) break
      const poster = absUrl(video.getAttribute('poster'), base) || undefined
      const src =
        absUrl(video.currentSrc || video.getAttribute('src'), base) ||
        absUrl(
          video.querySelector('source')?.getAttribute('src') || null,
          base,
        )
      pushVideo(src, { poster })
    }
  }

  // 确保至少有 1 张 preferred（若有图）
  if (images.length && !images.some((i) => i.preferred)) {
    images[0].preferred = true
  }

  return [...images, ...videos]
}
