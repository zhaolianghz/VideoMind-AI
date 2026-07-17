import { api } from './client'

export interface CookieInfo {
  platform: string
  has_cookie: boolean
  size: number
  updated_at: string | null
}

export const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  bilibili: 'B 站',
  douyin: '抖音',
  kuaishou: '快手',
  xiaohongshu: '小红书',
  tiktok: 'TikTok',
}

export const listCookies = (): Promise<CookieInfo[]> =>
  api.get<CookieInfo[]>('/settings/cookies').then((r) => r.data)

export const uploadCookie = (platform: string, content: string) =>
  api
    .put(`/settings/cookies/${platform}`, { platform, content })
    .then((r) => r.data)

export const deleteCookie = (platform: string): Promise<void> =>
  api.delete(`/settings/cookies/${platform}`).then(() => undefined)
