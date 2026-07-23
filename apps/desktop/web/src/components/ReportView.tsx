import { useEffect, useId, useState, type ReactElement } from 'react'
import { useI18n } from '../i18n'

type Translate = (key: string) => string

/**
 * Localized display label for a parsed-report field key.
 * Pass the i18n `t` so this works from both components and plain helpers
 * (e.g. the plain-text export in ReportDetail). Falls back to the raw key.
 */
export const labelOf = (k: string, t: Translate): string => {
  const lbl = t('analysisLabels.' + k)
  return lbl === 'analysisLabels.' + k ? k : lbl
}

// ── 语义识别：靠 key 名 + 值形态推断该字段属于哪种视觉 ──

/** 分数字段：0–10 / 0–50 / 0–100 的数值型评分 */
const SCORE_KEY = /(_score$|^score$|^total$|_index$|^emotion$|^conflict$|^tension$|^info_gap$|^resonance$)/
/** 标签/枚举字段：短词或短词数组，做成 chip */
const TAG_KEY = /(_tags$|^tags$|^category$|^grade$|^content_type$|^hook_type$|_triggers$|^style$)/
/** 条目标题字段：对象数组条目里可提升为「大标题」的 key */
const HEAD_KEY = /^(point|opinion|viewpoint|title|name|chapter|hook_text|formula|style|seg)$/
/** 汇总分（大环形展示）：total / *_index */
const HERO_SCORE_KEY = /(^total$|_index$)/

/** 该 key+值 是否是分数（数值，且 key 命中分数语义或本身 0..100 的整数分） */
function asScore(key: string, v: unknown): number | null {
  if (typeof v !== 'number' || !isFinite(v)) return null
  if (SCORE_KEY.test(key)) return v
  return null
}

/** 分数满值：*_index / total(五维50) / 其余按 10 分制推断 */
function scoreMax(key: string, v: number): number {
  if (/_index$/.test(key)) return 100
  if (key === 'total') return v > 10 ? 50 : 10
  return 10
}

/** 是否短标签（<=8 字、无换行），可 chip 化 */
function isShortTag(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= 8 && !v.includes('\n')
}

// ── 可视化色板：按索引轮换六个 vivid 色相（CSS 变量，随主题翻转明度） ──

const VIZ_N = 6
const viz = (i: number): string => `var(--viz-${(i % VIZ_N) + 1})`
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

// ── 动效基元 ──

/** 挂载后下一帧翻 true，驱动 CSS transition 入场（进度条填充/圆环描边） */
function useEntrance(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return on
}

/** 数字滚动到目标值；prefers-reduced-motion 时直达 */
function useCountUp(target: number, enabled: boolean, duration = 1100): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!enabled) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setV(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setV(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled, duration])
  return enabled ? v : 0
}

/** 滚动中的显示值：整数分取整，小数分保留 1 位 */
const fmtScore = (shown: number, target: number): string =>
  Number.isInteger(target) ? String(Math.round(shown)) : shown.toFixed(1)

// ── 评分可视化 ──

/** 渐变描边圆环：lg = 总分 hero，sm = 单独出现的分数 */
function Ring({ value, max, label, size }: {
  value: number
  max: number
  label: string
  size: 'sm' | 'lg'
}): ReactElement {
  const gradId = useId()
  const on = useEntrance()
  const shown = useCountUp(value, on)
  const ratio = clamp01(value / max)
  const lg = size === 'lg'
  const px = lg ? 112 : 68
  const r = lg ? 46 : 27
  const sw = lg ? 8 : 6
  const c = 2 * Math.PI * r

  const svg = (
    <div className="relative shrink-0" style={{ width: px, height: px }}>
      <svg viewBox={`0 0 ${px} ${px}`} width={px} height={px} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--viz-1)" />
            <stop offset="55%" stopColor="var(--viz-2)" />
            <stop offset="100%" stopColor="var(--viz-3)" />
          </linearGradient>
        </defs>
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={sw} />
        <circle
          cx={px / 2} cy={px / 2} r={r} fill="none"
          stroke={`url(#${gradId})`} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={on ? c * (1 - ratio) : c}
          style={{
            transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1) 0.15s',
            filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--viz-2) 45%, transparent))',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`vm-grad-text font-mono font-black leading-none tabular-nums ${lg ? 'text-3xl' : 'text-base'}`}>
          {fmtScore(shown, value)}
        </span>
        <span className={`text-tertiary ${lg ? 'mt-1 text-[10px]' : 'text-[9px]'} font-medium leading-none`}>
          /{max}
        </span>
      </div>
    </div>
  )

  if (lg) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-2 sm:px-3">
        {svg}
        <span className="text-xs font-semibold uppercase tracking-widest text-secondary">{label}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3">
      {svg}
      <span className="text-sm font-medium text-primary">{label}</span>
    </div>
  )
}

/** 维度评分条：每条独立色相，渐变亮尾 + 光晕，入场错峰填充 */
function ScoreBar({ label, value, max, color, delay }: {
  label: string
  value: number
  max: number
  color: string
  delay: number
}): ReactElement {
  const on = useEntrance()
  const shown = useCountUp(value, on, 900 + delay)
  const ratio = clamp01(value / max)
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-xs font-medium text-secondary">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-fill">
        <div
          className="h-full rounded-full"
          style={{
            width: on ? `${ratio * 100}%` : '0%',
            background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 55%, #fff))`,
            boxShadow: `0 0 10px color-mix(in srgb, ${color} 50%, transparent)`,
            transition: `width 0.9s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
          }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-sm font-bold tabular-nums" style={{ color }}>
        {fmtScore(shown, value)}
      </span>
    </div>
  )
}

/** 评分面板：总分大环形 + 分维度彩色光条，铺在极光渐变的 hero 卡上 */
function ScorePanel({ scores }: { scores: Array<[string, number]> }): ReactElement {
  const { t } = useI18n()
  const heroIdx = scores.findIndex(([k]) => HERO_SCORE_KEY.test(k))
  const hero = heroIdx >= 0 ? scores[heroIdx] : null
  const dims = heroIdx >= 0 ? scores.filter((_, i) => i !== heroIdx) : scores
  return (
    <div className="vm-score-hero vm-reveal rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col items-stretch gap-6 sm:flex-row sm:items-center">
        {hero && (
          <Ring value={hero[1]} max={scoreMax(hero[0], hero[1])} label={labelOf(hero[0], t)} size="lg" />
        )}
        {dims.length > 0 && (
          <div className="min-w-0 flex-1 space-y-3.5">
            {dims.map(([k, v], i) => (
              <ScoreBar
                key={k}
                label={labelOf(k, t)}
                value={v}
                max={scoreMax(k, v)}
                color={viz(i)}
                delay={200 + i * 120}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 结构渲染 ──

/**
 * 对象数组的单个条目：编辑部风格 —— 超大彩色序号 + 标题化首字段，
 * 其余字段挂同色细竖线，彻底告别卡片套卡片。
 */
function InsightItem({ item, index, depth }: {
  item: Record<string, unknown>
  index: number
  depth: number
}): ReactElement {
  const { t } = useI18n()
  const entries = Object.entries(item).filter(([k]) => !k.startsWith('_'))
  const headIdx = entries.findIndex(([k, v]) => typeof v === 'string' && HEAD_KEY.test(k))
  const head = headIdx >= 0 ? entries[headIdx] : null
  const rest = headIdx >= 0 ? entries.filter((_, i) => i !== headIdx) : entries
  const color = viz(index)
  return (
    <div className="flex gap-4 py-4 first:pt-0 last:pb-0">
      <span
        className="mt-0.5 shrink-0 select-none font-mono text-[22px] font-black leading-none tabular-nums"
        style={{ color }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="min-w-0 flex-1">
        {head && (
          <p className="text-[15px] font-semibold leading-relaxed text-primary">{String(head[1])}</p>
        )}
        {rest.length > 0 && (
          <div className={`space-y-3 ${head ? 'mt-3' : ''}`}>
            {rest.map(([k, v]) => (
              <div
                key={k}
                className="border-l-2 pl-3"
                style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}
              >
                <div
                  className="mb-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: `color-mix(in srgb, ${color} 65%, var(--text-secondary))` }}
                >
                  {labelOf(k, t)}
                </div>
                <ValueView field={k} value={v} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function ParsedView({ data, depth = 0 }: {
  data: Record<string, unknown>
  depth?: number
}): ReactElement {
  const { t } = useI18n()
  const entries = Object.entries(data).filter(([k]) => !k.startsWith('_'))

  // 分数字段成组：若本层有 ≥2 个分数字段，聚成评分面板
  const scoreEntries = entries.filter(([k, v]) => asScore(k, v) !== null) as Array<[string, number]>
  const restEntries = entries.filter(([k, v]) => asScore(k, v) === null)
  const groupScores = scoreEntries.length >= 2

  return (
    <div className={depth === 0 ? 'space-y-8' : 'space-y-4'}>
      {groupScores && <ScorePanel scores={scoreEntries} />}

      {(groupScores ? restEntries : entries).map(([k, v], i) => {
        const score = asScore(k, v)
        const reveal = depth === 0
          ? { className: 'vm-reveal', style: { animationDelay: `${(i + (groupScores ? 1 : 0)) * 80}ms` } }
          : { className: '', style: undefined }

        // 单独出现的分数 → 渐变环形
        if (score !== null && !groupScores) {
          return (
            <section key={k} className={reveal.className} style={reveal.style}>
              <Ring value={score} max={scoreMax(k, score)} label={labelOf(k, t)} size="sm" />
            </section>
          )
        }

        return (
          <section key={k} className={reveal.className} style={reveal.style}>
            {depth === 0 ? (
              <div className="mb-3.5 flex items-center gap-2.5">
                <span
                  className="h-4 w-1.5 rounded-full"
                  style={{ background: `linear-gradient(180deg, ${viz(i)}, color-mix(in srgb, ${viz(i)} 35%, transparent))` }}
                />
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-secondary">
                  {labelOf(k, t)}
                </h2>
              </div>
            ) : (
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-tertiary">
                {labelOf(k, t)}
              </div>
            )}
            <ValueView field={k} value={v} depth={depth} />
          </section>
        )
      })}
    </div>
  )
}

function ValueView({ field, value, depth }: {
  field: string
  value: unknown
  depth: number
}): ReactElement {
  if (Array.isArray(value)) {
    if (value.length === 0) return <div className="text-sm text-tertiary">—</div>

    // 全是短词 → chip 云，色相按索引轮换（标签/触发点/分类等）
    if (value.every(isShortTag) || TAG_KEY.test(field)) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((it, i) => (
            <span
              key={i}
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                background: `color-mix(in srgb, ${viz(i)} 13%, transparent)`,
                color: viz(i),
              }}
            >
              {String(it)}
            </span>
          ))}
        </div>
      )
    }

    // 对象数组 → 编辑部条目流（大序号 + 标题 + 竖线子字段），分隔线代替嵌套卡片
    if (typeof value[0] === 'object' && value[0] !== null) {
      return (
        <div className="divide-y divide-separator">
          {value.map((item, i) => (
            <InsightItem key={i} item={item as Record<string, unknown>} index={i} depth={depth} />
          ))}
        </div>
      )
    }

    // 字符串/数值列表 → 彩色序号的悬挂列表（要点/案例/建议）
    return (
      <div className="space-y-2.5">
        {value.map((it, i) => (
          <div key={i} className="flex gap-3">
            <span
              className="mt-[3px] shrink-0 select-none font-mono text-xs font-black tabular-nums"
              style={{ color: viz(i) }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-sm leading-relaxed text-primary">{String(it)}</span>
          </div>
        ))}
      </div>
    )
  }

  // 短标签值 → 单个 chip
  if (TAG_KEY.test(field) && isShortTag(value)) {
    return (
      <span
        className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ background: 'color-mix(in srgb, var(--viz-1) 13%, transparent)', color: 'var(--viz-1)' }}
      >
        {String(value)}
      </span>
    )
  }

  // 嵌套对象 → 细竖线缩进，不再包卡片
  if (value && typeof value === 'object') {
    return (
      <div className="border-l-2 border-separator pl-4">
        <ParsedView data={value as Record<string, unknown>} depth={depth + 1} />
      </div>
    )
  }

  // 长文本 → 舒适排版；短文本 → 普通段落
  const text = String(value)
  const isLong = text.length > 80
  return (
    <p className={`text-sm text-primary ${isLong ? 'leading-7' : 'leading-relaxed'}`}>
      {text}
    </p>
  )
}
