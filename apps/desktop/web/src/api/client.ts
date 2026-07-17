import axios from 'axios'

// 开发: '/api/v1' 经 vite proxy → 127.0.0.1:18791
// 生产(Tauri): Rust 通过 window.__VIDEOMIND_API_BASE__ 注入 sidecar 端口
const injected =
  typeof window !== 'undefined' &&
  (window as unknown as { __VIDEOMIND_API_BASE__?: string }).__VIDEOMIND_API_BASE__

export const api = axios.create({
  baseURL: injected ?? import.meta.env.VITE_API_BASE ?? '/api/v1',
})
