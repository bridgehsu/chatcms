/** MultiPost SyncData 精简类型（与 leaperone/MultiPost-Extension 对齐） */

export type FileData = {
  name: string
  url: string
  type?: string
  size?: number
}

export type DynamicData = {
  title: string
  content: string
  images: FileData[]
  videos: FileData[]
  tags?: string[]
}

export type SyncDataPlatform = {
  name: string
  injectUrl?: string
}

/** MultiPost SyncData */
export type SyncData = {
  platforms: SyncDataPlatform[]
  isAutoPublish: boolean
  data: DynamicData
}

export const REDNOTE_INJECT_URL =
  'https://creator.xiaohongshu.com/publish/publish?target=image'

export function buildRednoteSyncData(opts: {
  title: string
  content: string
  images: FileData[]
  tags?: string[]
  isAutoPublish?: boolean
}): SyncData {
  return {
    platforms: [
      {
        name: 'DYNAMIC_REDNOTE',
        injectUrl: REDNOTE_INJECT_URL,
      },
    ],
    isAutoPublish: !!opts.isAutoPublish,
    data: {
      title: opts.title,
      content: opts.content,
      images: opts.images,
      videos: [],
      tags: opts.tags,
    },
  }
}
