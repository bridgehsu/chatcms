/** 桌面桥页 ↔ 扩展：MultiPost window.postMessage 协议 */

import { MULTIPOST_PLATFORMS } from '../platforms'
import type { SyncData } from './types'

export type MultipostRequest = {
  type: 'request'
  traceId: string
  action: string
  data?: unknown
}

export type MultipostResponse = {
  type: 'response'
  traceId: string
  code: number
  message?: string
  data?: unknown
}

export const MULTIPOST_TRUST = 'MULTIPOST_EXTENSION_REQUEST_TRUST_DOMAIN'
export const MULTIPOST_PUBLISH = 'MULTIPOST_EXTENSION_PUBLISH'

export type PublishFromSyncPayload = {
  title: string
  content: string
  imageUrls: string[]
  isAutoPublish: boolean
  platforms: Array<{ id: string; name: string; injectUrl: string }>
}

/** SyncData → 扩展内部 OPEN_PUBLISH_TABS 载荷 */
export function syncDataToPublishPayload(raw: unknown): PublishFromSyncPayload {
  const sync = raw as SyncData
  if (!sync || !Array.isArray(sync.platforms) || sync.platforms.length === 0) {
    throw new Error('SyncData 缺少 platforms')
  }

  const platforms = sync.platforms
    .map((p) => {
      const id = String(p?.name || '').trim()
      if (!id) return null
      const catalog = MULTIPOST_PLATFORMS.find((x) => x.id === id)
      const injectUrl = String(p?.injectUrl || catalog?.injectUrl || '').trim()
      if (!injectUrl) return null
      return {
        id,
        name: catalog?.name || id,
        injectUrl,
      }
    })
    .filter((p): p is { id: string; name: string; injectUrl: string } => !!p)

  if (!platforms.length) {
    throw new Error('没有可打开的平台（缺少 injectUrl）')
  }

  const data = (sync.data || {}) as {
    title?: string
    content?: string
    images?: Array<{ url?: string }>
  }

  const imageUrls = Array.isArray(data.images)
    ? data.images
        .map((img) => String(img?.url || '').trim())
        .filter(Boolean)
    : []

  return {
    title: String(data.title || ''),
    content: String(data.content || ''),
    imageUrls,
    isAutoPublish: !!sync.isAutoPublish,
    platforms,
  }
}

export function isMultipostRequest(data: unknown): data is MultipostRequest {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    d.type === 'request' &&
    typeof d.traceId === 'string' &&
    typeof d.action === 'string'
  )
}

/** 本机发布桥（127.0.0.1 / localhost）自动信任 */
export function isLocalBridgeOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost'
  } catch {
    return false
  }
}
