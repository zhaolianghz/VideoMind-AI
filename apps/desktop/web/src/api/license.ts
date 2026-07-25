import { api } from './client'

export interface LicenseStatus {
  machine_code: string
  licensed: boolean
  tier: string
  features: string[]
  expires_at: string | null
  trial_active: boolean
  trial_days_left: number
  /** 前端附加：后端是否带 EE（CE 版 /license/status 404 → false，界面隐藏授权区） */
  available: boolean
}

const CE_FALLBACK: LicenseStatus = {
  machine_code: '',
  licensed: false,
  tier: 'ce',
  features: [],
  expires_at: null,
  trial_active: false,
  trial_days_left: 0,
  available: false,
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  try {
    const r = await api.get('/license/status')
    return { ...r.data, available: true }
  } catch {
    return CE_FALLBACK
  }
}

export async function activateLicense(code: string): Promise<LicenseStatus> {
  const r = await api.post('/license/activate', { code })
  return { ...r.data, available: true }
}
