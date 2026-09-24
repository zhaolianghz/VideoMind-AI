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

/** 本地导入支持的扩展名（与后端 LOCAL_MEDIA_EXTS 保持一致） */
export const MEDIA_EXTENSIONS = [
  'mp4', 'mov', 'mkv', 'avi', 'flv', 'webm', 'wmv', 'm4v', 'ts', 'mpg', 'mpeg', 'm2ts',
  'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma',
]

/**
 * 弹出原生文件选择框（可多选视频/音频），返回绝对路径数组。
 * 用户取消或非桌面环境返回空数组 —— 后端按路径读文件，浏览器拿不到真实路径。
 */
export const pickMediaFiles = async (): Promise<string[]> => {
  if (!isTauri()) return []
  try {
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Video / Audio', extensions: MEDIA_EXTENSIONS }],
    })
    if (!selected) return []
    return (Array.isArray(selected) ? selected : [selected]).filter(
      (p): p is string => typeof p === 'string',
    )
  } catch {
    return []
  }
}
