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
    },
});
