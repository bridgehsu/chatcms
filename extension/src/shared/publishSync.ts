/** 发布填表：SyncPayload + 桥脚本拉取（对齐 MultiPost） */

import { BRIDGE_BASE, type BridgePlatform } from './bridge'
import { platformsByKind, type PublishKind } from './platforms'
import { DEFAULT_REDNOTE_PUBLISH_SCRIPT } from './scripts/rednotePublish'

export type SyncImage = {
  name: string
  url: string
  type?: string
}

/** 注入到平台页的草稿载荷（脚本入参 data） */
export type SyncPayload = {
  title: string
  content: string
  images: SyncImage[]
  isAutoPublish: boolean
  platform: string
}

export type BridgePublishScript = {
  platform_id: string
  code: string
  kind: string
  script: string
  version: number
  match_url: string
}

export type ResolvedPublishScript = {
  source: string
  version: number
  matchUrl: string
  from: 'bridge' | 'builtin'
}

export type PublishPlatformView = {
  id: string
  name: string
  injectUrl: string
  hasScript: boolean
  scriptVersion: number
  kind: PublishKind
  region: 'cn' | 'intl'
}

export async function fetchBridgePlatforms(): Promise<BridgePlatform[]> {
  const res = await fetch(`${BRIDGE_BASE}/publish/platforms`)
  if (!res.ok) throw new Error(`平台列表失败 (${res.status})`)
  const list = (await res.json()) as BridgePlatform[]
  return Array.isArray(list) ? list : []
}

/** MultiPost 全量平台；桥侧 has_script 仅作增强标记 */
export async function loadPublishPlatforms(
  kind: PublishKind = 'dynamic',
): Promise<{
  platforms: PublishPlatformView[]
  bridgeOk: boolean
}> {
  let bridgeOk = false
  const scriptMap = new Map<string, { has: boolean; ver: number }>()
  try {
    const list = await fetchBridgePlatforms()
    bridgeOk = true
    for (const p of list) {
      const code = p.code || p.id
      scriptMap.set(code, {
        has: !!p.has_script,
        ver: p.script_version || 0,
      })
    }
  } catch {
    bridgeOk = false
  }

  const platforms = platformsByKind(kind).map((p) => {
    const hit = scriptMap.get(p.id)
    return {
      id: p.id,
      name: p.name,
      injectUrl: p.injectUrl,
      kind: p.kind,
      region: p.region,
      hasScript: !!p.hasBuiltinScript || !!hit?.has,
      scriptVersion: hit?.ver || 0,
    }
  })

  return { bridgeOk, platforms }
}

export async function fetchPublishScript(
  platform: string,
): Promise<BridgePublishScript | null> {
  try {
    const res = await fetch(
      `${BRIDGE_BASE}/publish/script?platform=${encodeURIComponent(platform)}`,
    )
    if (!res.ok) return null
    return (await res.json()) as BridgePublishScript
  } catch {
    return null
  }
}

/** 桥已发布脚本优先；小红书无脚本时用扩展内置兜底 */
export async function resolvePublishScript(
  platformCode: string,
): Promise<ResolvedPublishScript | null> {
  const remote = await fetchPublishScript(platformCode)
  if (remote?.script?.trim()) {
    return {
      source: remote.script.trim(),
      version: remote.version || 1,
      matchUrl: remote.match_url || '',
      from: 'bridge',
    }
  }
  if (platformCode === 'DYNAMIC_REDNOTE') {
    return {
      source: DEFAULT_REDNOTE_PUBLISH_SCRIPT,
      version: 0,
      matchUrl: 'https://creator.xiaohongshu.com/',
      from: 'builtin',
    }
  }
  return null
}

export function matchUrlOk(tabUrl: string | undefined, matchUrl: string): boolean {
  const m = matchUrl.trim()
  if (!m) return true
  if (!tabUrl) return false
  try {
    return tabUrl.startsWith(m) || tabUrl.includes(m)
  } catch {
    return false
  }
}
