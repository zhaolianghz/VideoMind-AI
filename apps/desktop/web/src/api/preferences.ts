import { api } from './client'

export interface Preferences {
  transcribe_model: string
  transcribe_language: string
}

export const getPreferences = (): Promise<Preferences> =>
  api.get<Preferences>('/settings/preferences').then((r) => r.data)

export const putPreferences = (p: Partial<Preferences>): Promise<Preferences> =>
  api.put<Preferences>('/settings/preferences', p).then((r) => r.data)
