/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // 主题由 <html data-theme="dark"> 驱动；system 时无属性 → 交给 CSS 的 prefers-color-scheme
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      // Apple 语义色板：全部映射到 index.css 的 CSS 变量，随主题切换自动翻转
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        material: 'var(--material)',
        fill: 'var(--fill)',
        app: 'var(--border)', // border-app / divide-app
        separator: 'var(--separator)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'on-accent': 'var(--on-accent)',
        danger: 'var(--danger)',
        warning: 'var(--warning)',
        success: 'var(--success)',
      },
      fontFamily: {
        // Apple：优先系统字体（macOS = SF Pro），CJK 回退，Geist 作为兜底
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          'system-ui',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        mono: ['Geist Mono Variable', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
