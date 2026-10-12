/** 与桌面业务地图同源的导航类型（精简视图） */

export type MapLink = {
  id: string
  title: string
  desc: string
  mark: string
  url?: string | null
  tone?: string | null
}

export type MapSection = {
  id: string
  title: string
  icon: string
  url?: string | null
  sort_order?: number
  locked: boolean
  collapsed: boolean
  links: MapLink[]
}

export type MapNavView = {
  favorites: MapLink[]
  sections: MapSection[]
}

export const FAVORITES_SECTION_ID = 'favorites'
