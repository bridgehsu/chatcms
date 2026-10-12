import { platformsByKind, type PublishKind } from './platforms'

export const PUBLISH_DRAFT_KEY = 'publishDraft'
export const APP_MODULE_KEY = 'appModule'

/** 与 MultiPost 顶栏一致：动态 | 视频 | 播客 | 文章 */
export type PublishType = PublishKind

export type AppModule = 'chat' | 'nav' | 'publish'

/** note = 从内容管理选；manual = 手输（发布后需写入内容管理） */
export type PublishContentSource = 'note' | 'manual'

export type PublishDraft = {
  type: PublishType
  title: string
  body: string
  summary: string
  /** 配图：工厂 URL 或已入库直链 */
  imageUrls: string[]
  /** 视频：工厂 URL（视频类平台） */
  videoUrls: string[]
  /** 来自图片工厂的 id（与 imageUrls 对应，便于去重） */
  imageIds: string[]
  videoIds: string[]
  platformIds: string[]
  contentSource: PublishContentSource
  /** 内容管理笔记 id；manual 发布入库后也会写入 */
  noteId: string | null
  noteTitle: string
  updatedAt: number
}

export const DEFAULT_PUBLISH_DRAFT = (): PublishDraft => ({
  type: 'dynamic',
  title: '',
  body: '',
  summary: '',
  imageUrls: [],
  videoUrls: [],
  imageIds: [],
  videoIds: [],
  platformIds: ['DYNAMIC_REDNOTE'],
  contentSource: 'note',
  noteId: null,
  noteTitle: '',
  updatedAt: Date.now(),
})

function parseStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((u) => String(u).trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/\n+/)
      .map((u) => u.trim())
      .filter(Boolean)
  }
  return []
}

export function normalizeDraft(raw: unknown): PublishDraft {
  const d = DEFAULT_PUBLISH_DRAFT()
  if (!raw || typeof raw !== 'object') return d
  const o = raw as Partial<PublishDraft>
  if (
    o.type === 'dynamic' ||
    o.type === 'article' ||
    o.type === 'video' ||
    o.type === 'podcast'
  ) {
    d.type = o.type
  }
  if (typeof o.title === 'string') d.title = o.title
  if (typeof o.body === 'string') d.body = o.body
  if (typeof o.summary === 'string') d.summary = o.summary
  d.imageUrls = parseStringList(o.imageUrls)
  d.videoUrls = parseStringList(o.videoUrls)
  d.imageIds = parseStringList(o.imageIds)
  d.videoIds = parseStringList(o.videoIds)
  if (Array.isArray(o.platformIds)) {
    d.platformIds = o.platformIds.map((id) => String(id)).filter(Boolean)
  }
  if (o.contentSource === 'note' || o.contentSource === 'manual') {
    d.contentSource = o.contentSource
  }
  if (typeof o.noteId === 'string' && o.noteId) d.noteId = o.noteId
  else if (o.noteId === null) d.noteId = null
  if (typeof o.noteTitle === 'string') d.noteTitle = o.noteTitle
  if (typeof o.updatedAt === 'number') d.updatedAt = o.updatedAt
  return d
}

export async function loadPublishDraft(): Promise<PublishDraft> {
  const r = await chrome.storage.local.get(PUBLISH_DRAFT_KEY)
  return normalizeDraft(r[PUBLISH_DRAFT_KEY])
}

export async function savePublishDraft(draft: PublishDraft): Promise<void> {
  await chrome.storage.local.set({
    [PUBLISH_DRAFT_KEY]: { ...draft, updatedAt: Date.now() },
  })
}

export function defaultPlatformIdsForKind(kind: PublishKind): string[] {
  const list = platformsByKind(kind)
  const red = list.find((p) => p.id === 'DYNAMIC_REDNOTE')
  if (red) return [red.id]
  return list.slice(0, 1).map((p) => p.id)
}
