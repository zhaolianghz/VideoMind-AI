# VideoMind AI · UI 改进计划

> 状态：**已规划，待实施**
> 依据：`design-taste-frontend` skill（Anti-Slop Frontend）的通用审美规则
> 编写日期：2024-07

---

## 一、Design Read

> Reading this as: **pro desktop dashboard**（面向企业市场部 / 研究员 / 内容创作者），with a **暗色 dev-tool / pro-app** 设计语言（对标 Linear / Raycast / Vercel 后台），leaning toward Tailwind + Geist + Phosphor + 克制 motion。

**Dials**（dashboard 场景，非 landing）:
- `DESIGN_VARIANCE: 5`（结构化专业 app，不需 artsy）
- `MOTION_INTENSITY: 3`（克制，仅 transition + tactile + 轻量 enter）
- `VISUAL_DENSITY: 6`（信息密度中等偏高，pro 用户）

### 范围说明
`design-taste-frontend` skill 明确声明 **"Not dashboards, not data tables, not multi-step product UI"**。VideoMind AI 是桌面应用 dashboard，因此 skill 中 **landing-page 专属规则不适用**（hero / bento / eyebrow / split-header / 视觉资产策略 / logo wall 等）。本计划只采用 skill 的**通用审美与工程规则**：AI Tells、字体、颜色、圆角一致性、对比度、tactile、状态、icon。

---

## 二、当前 UI Audit

| # | 问题 | skill 规则依据 | 严重度 |
|---|------|----------------|--------|
| 1 | Sidebar 用 emoji 图标（🏠➕📂📊🤖⚙️） | §3.C icon library / §3.D emoji policy | 🔴 最明显的 AI tell |
| 2 | 系统字体栈（-apple-system…） | §4.1 默认应用 Geist/Satoshi 等有性格字体 | 🔴 无品牌感 |
| 3 | 圆角混用：按钮/输入 `rounded-lg`、卡片 `rounded-xl`、标签 `rounded` | §4.4 SHAPE CONSISTENCY LOCK | 🟡 不统一=廉价感 |
| 4 | emerald-600 强调色 | §4.2（neutral+单强调 ✅ 合格） | 🟢 可保留，仅精炼 |
| 5 | 按钮无 `:active` tactile 反馈 | §4.5 translate-y/scale | 🟡 点上去没物理感 |
| 6 | loading 是纯文字"加载中…" | §4.5 应用骨架屏 | 🟡 |
| 7 | 卡片过度包裹 | §4.4 elevation 需表达真实层级 | 🟡 部分 |
| 8 | 纯暗色无 light mode | §8 双模默认 | 🟢 dev-tool 可接受纯暗 |
| 9 | 状态徽章纯色块 | — | 🟡 dot+文字更精致 |

**结论**：暗色 + emerald 单强调的配色骨架合格（符合 §4.2 LILA RULE 的反面）。最大问题是 **emoji 图标 + 系统字体 + 圆角不统一** —— 这三件让整个 app 一眼"AI 生成感"。

---

## 三、改进计划

### P0 — 立竿见影（改这三样 = 质变）

> 目标：消除最强烈的 AI tell，建立专业 pro-app 基线。

#### P0-1 图标：emoji → Phosphor Icons
- **依赖**：`@phosphor-icons/react`
- **规则**：§3.C（一个 icon 家族 / 项目，统一 `strokeWidth`，禁手绘 SVG）
- **改动**：
  - `Sidebar.tsx`：🏠→`House`、➕→`Plus`、📂→`FolderOpen`、📊→`ChartBar`、🤖→`Robot`、⚙️→`Gear`
  - 全项目 `weight="regular"`，统一尺寸 `size={18}`
- **验收**：代码中无残留 emoji 字符（除品牌/mark 用途）

#### P0-2 字体：系统字体 → Geist
- **依赖**：`@fontsource-variable/geist` + `@fontsource-variable/geist-mono`
- **规则**：§4.1（默认避免 Inter，选 Geist；数字用 mono）
- **改动**：
  - `main.tsx` import 两个字体
  - `index.css` body → `font-family: 'Geist Variable'`
  - 数字/平台标签/时间戳 → `font-family: 'Geist Mono Variable'`（utility class `.font-mono`）
- **验收**：标题/正文用 Geist，所有数字（播放量、时长、端口、统计）用 Geist Mono

#### P0-3 圆角统一（SHAPE LOCK）
- **规则**：§4.4（全项目一套圆角 scale）
- **约定**：
  - 按钮 / 输入框：`rounded-lg`（8px）
  - 卡片 / 面板：`rounded-xl`（12px）
  - 状态徽章 / 小标签：`rounded-full`（胶囊）
- **改动**：全局审计 `rounded` / `rounded-md`，统一到上述三档
- **验收**：无 `rounded`(4) / `rounded-md`(6) 残留；每个圆角符合 scale

---

### P1 — 精致化

#### P1-1 Tactile 反馈
- **规则**：§4.5 `:active scale-[0.98]`
- **改动**：所有可点按钮加 `transition active:scale-[0.98]`
- **涉及**：`Sidebar` / `Providers` / `Library` / `Reports` / `NewTask` 所有 `<button>`

#### P1-2 Sidebar 品牌化 + active 强化
- logo 区：品牌 mark（几何图形，非 emoji）+ 产品名
- active 态：左侧 2px emerald accent bar + 更强背景对比
- 底部版本/状态区精炼

#### P1-3 状态徽章 → dot + 文字
- **规则**：信息状态用脉冲 dot + 文字标签，而非整块色填充
- **涉及**：`Library`（video status）、`Reports`（analysis status）
- 进行中态（collecting/transcribing/running）的 dot 加呼吸动画

#### P1-4 Loading → 骨架屏
- **规则**：§4.5（骨架匹配最终布局形状，禁纯文字/spinner）
- **涉及**：`Library` / `Reports` / `Providers` 列表加载态
- 卡片形 `animate-pulse` 占位

#### P1-5 卡片层级精简
- **规则**：§4.4（elevation 表达真实层级，否则用 `divide-y` / 负空间）
- Dashboard 的 3 个统计卡：考虑改为一行 `divide-x` 或去边框
- 列表项：去卡片背景，用 `divide-y` 分隔

---

### P2 — 锦上添花（可选）

#### P2-1 轻量 motion（`motion/react`）
- **规则**：§5（motion 需有动机；dashboard 克制）
- 列表项 enter stagger（`whileInView` opacity+y，delay 级联）
- Modal/弹窗淡入 + 轻微 scale
- **强制**：`useReducedMotion()` 降级（§6.B）

#### P2-2 Light Mode
- **规则**：§8 双模默认（但 dev-tool 类可纯暗，标注为有意决定）
- 用 Tailwind `dark:` variant 或 CSS 变量 token 化
- 当前决定：**暂保持纯暗**（pro 工具属性），如需双模再启用

---

## 四、技术依赖清单（实施时安装）

```bash
cd apps/desktop/web
npm install @phosphor-icons/react @fontsource-variable/geist @fontsource-variable/geist-mono
# P2 可选：
npm install motion
```

> §3.F 依赖验证：实施前确认 package.json，缺则先装。

---

## 五、Pre-Flight Check（ship 前机械检查）

- [ ] **无 emoji 图标**：grep 源码无 🏠➕📂📊🤖⚙️ 等字符（§3.D）
- [ ] **圆角统一**：grep `rounded\b`/`rounded-md` 为 0，全部落到 lg/xl/full 三档（§4.4）
- [ ] **字体**：body 用 Geist，数字用 Geist Mono（§4.1）
- [ ] **按钮对比**：所有 CTA 文字 vs 背景过 WCAG AA（§4.5）
- [ ] **tactile**：所有 `<button>` 有 `active:scale`（§4.5）
- [ ] **loading 是骨架**：无"加载中…"纯文字态（§4.5）
- [ ] **accent 一致**：全项目仅 emerald 一个强调色（§4.2 COLOR LOCK）
- [ ] **reduced-motion**：若引入 motion，有 `useReducedMotion` 降级（§6.B）

---

## 六、明确不做项（skill landing 规则，dashboard 不适用）

- ❌ Hero / Bento / Eyebrow / Split-header 等 landing 布局规则
- ❌ 视觉资产（产品摄影 / logo wall）—— 这是工具 app，非营销页
- ❌ 滚动驱动动画 / sticky-stack / horizontal-pan —— dashboard 无长滚动叙事
- ❌ 强 motion（MOTION_INTENSITY 保持 3，仅 transition + tactile + 轻量 enter）

---

## 七、实施顺序建议

1. **先 P0**（icon + 字体 + 圆角）—— 一次提交，视觉质变
2. 再 P1（tactile + sidebar + 状态 + 骨架 + 卡片精简）
3. P2 视需要

每步后跑 `npm run build` + 本地点击验证，再进入下一步。
