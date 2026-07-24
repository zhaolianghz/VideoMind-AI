/**
 * 镜像后端 videomind/core/collector/platforms.py 的链接识别逻辑，供前端预判：
 * 决定抖音博主主页走 webview 采集分支，而非直接调会失败的 /creators/collect。
 *
 * 注意：抖音短链（v.douyin.com/xxx）无法在前端判断是否为主页（要跟重定向），
 * 所以 isDouyinLink 只做"是不是抖音"的粗判，真正的主页判定交给 Rust 侧
 * collect_douyin_creator 里的 resolve_creator_url。
 */

/** 分享口令里截 URL 的正则（到空白或中文字符截断）。 */
const URL_RE = /https?:\/\/[^\s一-鿿，。；：、“”‘’《》【】()（）<>]+/

/** 从分享口令文本里抽第一个 URL；没有则原样返回（交后续报错）。 */
export function extractShareUrl(text: string): string {
  const m = text.match(URL_RE)
  return m ? m[0].replace(/[.,;!?'"']+$/, '') : text.trim()
}

const DOUYIN_HOST = /(^|\.)(douyin\.com|iesdouyin\.com)$/

/** 是否是抖音相关链接（含 v.douyin.com 短链）。前端据此决定是否走 webview 采集。 */
export function isDouyinLink(text: string): boolean {
  const u = extractShareUrl(text)
  try {
    const host = new URL(u).hostname.toLowerCase()
    return host === 'v.douyin.com' || DOUYIN_HOST.test(host)
  } catch {
    return false
  }
}
