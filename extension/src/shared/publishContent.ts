/** 发布装填：内容管理笔记 + 图片/视频工厂 */

import { BRIDGE_BASE } from './bridge'

export type BridgeNote = {
  id: string
  title: string
  content: string
  icon: string
  group_id?: string | null
  created_at: number
  updated_at: number
}

export type BridgeNoteGroup = {
  id: string
  name: string
  sort_order: number
}

export type BridgeNotesBundle = {
  notes: BridgeNote[]
  groups: BridgeNoteGroup[]
}

export type BridgeMediaItem = {
  id: string
  kind: 'image' | 'video' | string
  title: string
  remark: string
  url: string
  created: number
  updated: number
}

export type MediaImportResult = {
  ok: boolean
  client_id?: string
  kind?: string
  id?: string
  error?: string
}

export async function fetchContentNotes(): Promise<BridgeNotesBundle> {
  const res = await fetch(`${BRIDGE_BASE}/content/notes`)
  if (!res.ok) throw new Error(`内容管理不可用 (${res.status})`)
  const data = (await res.json()) as BridgeNotesBundle
  return {
    notes: Array.isArray(data.notes) ? data.notes : [],
    groups: Array.isArray(data.groups) ? data.groups : [],
  }
}

export async function fetchContentNote(id: string): Promise<BridgeNote> {
  const res = await fetch(`${BRIDGE_BASE}/content/notes/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(res.status === 404 ? '笔记不存在' : `读取笔记失败 (${res.status})`)
  return (await res.json()) as BridgeNote
}

export async function createContentNote(input: {
  title: string
  content: string
  icon?: string
  group_id?: string | null
}): Promise<BridgeNote> {
  const res = await fetch(`${BRIDGE_BASE}/content/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      content: input.content,
      icon: input.icon,
      group_id: input.group_id || null,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `保存到内容管理失败 (${res.status})`)
  }
  return (await res.json()) as BridgeNote
}

export async function fetchFactoryImages(): Promise<BridgeMediaItem[]> {
  const res = await fetch(`${BRIDGE_BASE}/media/images`)
  if (!res.ok) throw new Error(`图片工厂不可用 (${res.status})`)
  const list = (await res.json()) as BridgeMediaItem[]
  return Array.isArray(list) ? list : []
}

export async function fetchFactoryVideos(): Promise<BridgeMediaItem[]> {
  const res = await fetch(`${BRIDGE_BASE}/media/videos`)
  if (!res.ok) throw new Error(`视频工厂不可用 (${res.status})`)
  const list = (await res.json()) as BridgeMediaItem[]
  return Array.isArray(list) ? list : []
}

export function factoryMediaUrl(kind: 'image' | 'video', id: string): string {
  return `${BRIDGE_BASE}/media/${kind}/${encodeURIComponent(id)}`
}

/** 上传本地文件到桌面图片/视频工厂，返回工厂条目 */
export async function uploadToFactory(
  file: File,
  kind: 'image' | 'video',
): Promise<BridgeMediaItem> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const data_base64 = btoa(binary)
  const res = await fetch(`${BRIDGE_BASE}/media/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          kind,
          url: file.name || 'upload',
          title: file.name || undefined,
          content_type: file.type || undefined,
          data_base64,
          client_id: `upload-${Date.now()}`,
        },
      ],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `上传失败 (${res.status})`)
  }
  const data = (await res.json()) as { results: MediaImportResult[] }
  const item = data.results?.[0]
  if (!item?.ok || !item.id) {
    throw new Error(item?.error || '上传失败')
  }
  return {
    id: item.id,
    kind,
    title: file.name || item.id,
    remark: '',
    url: factoryMediaUrl(kind, item.id),
    created: Date.now(),
    updated: Date.now(),
  }
}
