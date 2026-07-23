import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
// P0: dev 时 /api 经 vite proxy 转发到本地 FastAPI (18791)
// 生产(Tauri 打包): 由 Rust 注入 sidecar 端口到 VITE_API_BASE
export default defineConfig({
    plugins: [react()],
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        proxy: {
            '/api': 'http://127.0.0.1:18791',
        },
        // 字体装在 monorepo 根 node_modules（@fontsource-variable），
        // 默认 fs.allow 仅限 web/；放开到上三级仓库根，消除字体 403 告警。
        // 相对路径以本 config 所在目录（web/）为基准解析。
        fs: {
            allow: ['../../..'],
        },
    },
});
