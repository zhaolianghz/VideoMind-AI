import { isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

export { isTauri }

/**
 * 弹出原生目录选择框，返回所选目录绝对路径；用户取消或非桌面环境返回 null。
 * 浏览器（make web 纯前端调试）无原生对话框；tauri dev / 打包均可正常弹出。
 */
export const pickDirectory = async (): Promise<string | null> => {
  if (!isTauri()) return null
  try {
    const selected = await open({ directory: true, multiple: false })
    if (!selected) return null
    return typeof selected === 'string' ? selected : null
  } catch {
    return null
  }
}
