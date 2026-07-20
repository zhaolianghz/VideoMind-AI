import { useEffect, useState } from 'react'
import { createProvider, deleteProvider, listProviders, testProvider, updateProvider } from '../api/providers'
import type { ProviderTestResult } from '../api/providers'
import type { Provider, ProviderDraft } from '../types'

// ── 服务商 logo（LobeHub AI 品牌图标，随应用打包） ──
import logoOpenai from '@lobehub/icons-static-svg/icons/openai.svg'
import logoClaude from '@lobehub/icons-static-svg/icons/claude-color.svg'
import logoGemini from '@lobehub/icons-static-svg/icons/gemini-color.svg'
import logoGrok from '@lobehub/icons-static-svg/icons/grok.svg'
import logoMistral from '@lobehub/icons-static-svg/icons/mistral-color.svg'
import logoGroq from '@lobehub/icons-static-svg/icons/groq.svg'
import logoPerplexity from '@lobehub/icons-static-svg/icons/perplexity-color.svg'
import logoTogether from '@lobehub/icons-static-svg/icons/together-color.svg'
import logoCohere from '@lobehub/icons-static-svg/icons/cohere-color.svg'
import logoAzure from '@lobehub/icons-static-svg/icons/azure-color.svg'
import logoBedrock from '@lobehub/icons-static-svg/icons/bedrock-color.svg'
import logoDeepseek from '@lobehub/icons-static-svg/icons/deepseek-color.svg'
import logoQwen from '@lobehub/icons-static-svg/icons/qwen-color.svg'
import logoKimi from '@lobehub/icons-static-svg/icons/kimi-color.svg'
import logoZhipu from '@lobehub/icons-static-svg/icons/zhipu-color.svg'
import logoMinimax from '@lobehub/icons-static-svg/icons/minimax-color.svg'
import logoDoubao from '@lobehub/icons-static-svg/icons/doubao-color.svg'
import logoWenxin from '@lobehub/icons-static-svg/icons/wenxin-color.svg'
import logoHunyuan from '@lobehub/icons-static-svg/icons/hunyuan-color.svg'
import logoSpark from '@lobehub/icons-static-svg/icons/spark-color.svg'
import logoStepfun from '@lobehub/icons-static-svg/icons/stepfun-color.svg'
import logoYi from '@lobehub/icons-static-svg/icons/yi-color.svg'
import logoBaichuan from '@lobehub/icons-static-svg/icons/baichuan-color.svg'
import logoSensenova from '@lobehub/icons-static-svg/icons/sensenova-color.svg'
import logoSiliconcloud from '@lobehub/icons-static-svg/icons/siliconcloud-color.svg'
import logoOpenrouter from '@lobehub/icons-static-svg/icons/openrouter.svg'
import logoAihubmix from '@lobehub/icons-static-svg/icons/aihubmix-color.svg'
import logoOllama from '@lobehub/icons-static-svg/icons/ollama.svg'
import logoLmstudio from '@lobehub/icons-static-svg/icons/lmstudio.svg'
import logoVllm from '@lobehub/icons-static-svg/icons/vllm-color.svg'

/** 预置服务商：卡片默认展示，点"添加"展开填 API Key 即可用 */
interface Preset {
  name: string
  logo: string
  /** 单色 logo 需要反白 */
  mono?: boolean
  kind: Provider['kind']
  base_url: string
  default_model: string
  desc: string
  needKey: boolean
  /** 官网 */
  site: string
}

interface Group {
  title: string
  presets: Preset[]
}

const GROUPS: Group[] = [
  {
    title: '国际主流',
    presets: [
      { name: 'OpenAI', logo: logoOpenai, mono: true, kind: 'openai_compat', base_url: 'https://api.openai.com/v1', default_model: 'gpt-5.5', desc: 'GPT 系列旗舰模型', needKey: true, site: 'https://platform.openai.com' },
      { name: 'Anthropic Claude', logo: logoClaude, kind: 'anthropic', base_url: 'https://api.anthropic.com/v1', default_model: 'claude-sonnet-5', desc: 'Claude 系列模型', needKey: true, site: 'https://console.anthropic.com' },
      { name: 'Google Gemini', logo: logoGemini, kind: 'openai_compat', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', default_model: 'gemini-2.5-pro', desc: 'Gemini 多模态模型', needKey: true, site: 'https://aistudio.google.com' },
      { name: 'xAI Grok', logo: logoGrok, mono: true, kind: 'openai_compat', base_url: 'https://api.x.ai/v1', default_model: 'grok-4', desc: 'xAI Grok 模型', needKey: true, site: 'https://console.x.ai' },
      { name: 'Mistral', logo: logoMistral, kind: 'openai_compat', base_url: 'https://api.mistral.ai/v1', default_model: 'mistral-large-latest', desc: '欧洲开源之光', needKey: true, site: 'https://console.mistral.ai' },
      { name: 'Groq', logo: logoGroq, mono: true, kind: 'openai_compat', base_url: 'https://api.groq.com/openai/v1', default_model: 'llama-4-maverick', desc: 'LPU 超低延迟推理', needKey: true, site: 'https://console.groq.com' },
      { name: 'Perplexity', logo: logoPerplexity, kind: 'openai_compat', base_url: 'https://api.perplexity.ai', default_model: 'sonar-pro', desc: '在线搜索增强模型', needKey: true, site: 'https://www.perplexity.ai' },
      { name: 'Together AI', logo: logoTogether, kind: 'openai_compat', base_url: 'https://api.together.xyz/v1', default_model: 'meta-llama/Llama-4-Maverick', desc: '开源模型托管', needKey: true, site: 'https://api.together.ai' },
      { name: 'Cohere', logo: logoCohere, kind: 'openai_compat', base_url: 'https://api.cohere.ai/compatibility/v1', default_model: 'command-a-03-2025', desc: 'RAG / 企业检索', needKey: true, site: 'https://dashboard.cohere.com' },
      { name: 'Azure OpenAI', logo: logoAzure, kind: 'openai_compat', base_url: 'https://{资源名}.openai.azure.com/openai/v1', default_model: 'gpt-5.5', desc: '微软云托管 GPT', needKey: true, site: 'https://portal.azure.com' },
      { name: 'AWS Bedrock', logo: logoBedrock, kind: 'openai_compat', base_url: 'https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1', default_model: 'anthropic.claude-sonnet-5', desc: '亚马逊云模型仓', needKey: true, site: 'https://console.aws.amazon.com/bedrock' },
    ],
  },
  {
    title: '国内主流',
    presets: [
      { name: 'DeepSeek', logo: logoDeepseek, kind: 'openai_compat', base_url: 'https://api.deepseek.com/v1', default_model: 'deepseek-chat', desc: 'V3 性价比之选', needKey: true, site: 'https://platform.deepseek.com' },
      { name: '阿里通义千问', logo: logoQwen, kind: 'openai_compat', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', default_model: 'qwen-max', desc: '通义 Qwen 系列', needKey: true, site: 'https://dashscope.console.aliyun.com' },
      { name: 'Moonshot Kimi', logo: logoKimi, kind: 'openai_compat', base_url: 'https://api.moonshot.cn/v1', default_model: 'kimi-k2', desc: '长上下文理解', needKey: true, site: 'https://platform.moonshot.cn' },
      { name: '智谱 GLM', logo: logoZhipu, kind: 'openai_compat', base_url: 'https://open.bigmodel.cn/api/paas/v4', default_model: 'glm-5', desc: 'GLM 系列模型', needKey: true, site: 'https://open.bigmodel.cn' },
      { name: 'MiniMax', logo: logoMinimax, kind: 'openai_compat', base_url: 'https://api.minimax.chat/v1', default_model: 'MiniMax-M3', desc: 'Agent 与多模态', needKey: true, site: 'https://platform.minimaxi.com' },
      { name: '字节豆包', logo: logoDoubao, kind: 'openai_compat', base_url: 'https://ark.cn-beijing.volces.com/api/v3', default_model: 'doubao-1.5-pro-32k', desc: '火山方舟引擎', needKey: true, site: 'https://console.volcengine.com/ark' },
      { name: '百度文心', logo: logoWenxin, kind: 'openai_compat', base_url: 'https://qianfan.baidubce.com/v2', default_model: 'ernie-5.0', desc: '千帆 ERNIE 系列', needKey: true, site: 'https://console.bce.baidu.com/qianfan' },
      { name: '腾讯混元', logo: logoHunyuan, kind: 'openai_compat', base_url: 'https://api.hunyuan.cloud.tencent.com/v1', default_model: 'hunyuan-turbos', desc: '腾讯云大模型', needKey: true, site: 'https://console.cloud.tencent.com/hunyuan' },
      { name: '讯飞星火', logo: logoSpark, kind: 'openai_compat', base_url: 'https://spark-api-open.xf-yun.com/v1', default_model: '4.0Ultra', desc: '科大讯飞 Spark', needKey: true, site: 'https://console.xfyun.cn' },
      { name: '阶跃星辰', logo: logoStepfun, kind: 'openai_compat', base_url: 'https://api.stepfun.com/v1', default_model: 'step-2-16k', desc: 'Step 系列模型', needKey: true, site: 'https://platform.stepfun.com' },
      { name: '零一万物', logo: logoYi, kind: 'openai_compat', base_url: 'https://api.lingyiwanwu.com/v1', default_model: 'yi-lightning', desc: 'Yi 系列模型', needKey: true, site: 'https://platform.lingyiwanwu.com' },
      { name: '百川智能', logo: logoBaichuan, kind: 'openai_compat', base_url: 'https://api.baichuan-ai.com/v1', default_model: 'Baichuan4-Turbo', desc: 'Baichuan 系列', needKey: true, site: 'https://platform.baichuan-ai.com' },
      { name: '商汤日日新', logo: logoSensenova, kind: 'openai_compat', base_url: 'https://api.sensenova.cn/compatible-mode/v1', default_model: 'SenseChat-5', desc: 'SenseNova 系列', needKey: true, site: 'https://console.sensecore.cn' },
    ],
  },
  {
    title: '聚合中转',
    presets: [
      { name: 'OpenRouter', logo: logoOpenrouter, mono: true, kind: 'openai_compat', base_url: 'https://openrouter.ai/api/v1', default_model: 'anthropic/claude-sonnet-5', desc: '聚合数百种模型', needKey: true, site: 'https://openrouter.ai' },
      { name: '硅基流动', logo: logoSiliconcloud, kind: 'openai_compat', base_url: 'https://api.siliconflow.cn/v1', default_model: 'deepseek-ai/DeepSeek-V3', desc: '国产模型聚合', needKey: true, site: 'https://cloud.siliconflow.cn' },
      { name: 'AiHubMix', logo: logoAihubmix, kind: 'openai_compat', base_url: 'https://aihubmix.com/v1', default_model: 'gpt-5.5', desc: '国内可用的聚合中转', needKey: true, site: 'https://aihubmix.com' },
    ],
  },
  {
    title: '本地',
    presets: [
      { name: 'Ollama（本地）', logo: logoOllama, mono: true, kind: 'openai_compat', base_url: 'http://localhost:11434/v1', default_model: 'llama4', desc: '免费本地运行，无需 Key', needKey: false, site: 'https://ollama.com' },
      { name: 'LM Studio（本地）', logo: logoLmstudio, mono: true, kind: 'openai_compat', base_url: 'http://localhost:1234/v1', default_model: 'local-model', desc: '桌面端本地推理', needKey: false, site: 'https://lmstudio.ai' },
      { name: 'vLLM（自建）', logo: logoVllm, kind: 'openai_compat', base_url: 'http://localhost:8000/v1', default_model: 'Qwen/Qwen2.5-72B-Instruct', desc: '自建推理服务', needKey: false, site: 'https://docs.vllm.ai' },
    ],
  },
]

const ALL_PRESETS = GROUPS.flatMap((g) => g.presets)
const presetGroup = (p: Preset) => GROUPS.find((g) => g.presets.includes(p))!.title

const ALL_TAB = '全部'
const CUSTOM_TAB = '自定义'
const TABS = [ALL_TAB, ...GROUPS.map((g) => g.title), CUSTOM_TAB]

export function Providers() {
  const [items, setItems] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB)
  const [query, setQuery] = useState('')
  /** 当前展开配置的卡片：预置名 / provider id */
  const [expanded, setExpanded] = useState<string | null>(null)
  /** 右上角"添加自定义"弹窗 */
  const [showCustomModal, setShowCustomModal] = useState(false)

  const load = () => {
    setLoading(true)
    listProviders()
      .then(setItems)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const findConfigured = (preset: Preset) => items.find((p) => p.name === preset.name) ?? null
  const customItems = items.filter((p) => !ALL_PRESETS.some((s) => s.name === p.name))

  const handleDelete = (p: Provider, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteProvider(p.id).then(() => {
      setExpanded(null)
      load()
    })
  }

  const onSaved = () => {
    setExpanded(null)
    setShowCustomModal(false)
    load()
  }

  // ── 筛选：分类 chip × 搜索词 叠加 ──
  const q = query.trim().toLowerCase()
  const hitPreset = (p: Preset) =>
    !q || [p.name, p.desc, p.default_model, p.base_url].some((s) => s.toLowerCase().includes(q))
  const hitCustom = (p: Provider) =>
    !q || [p.name, p.default_model, p.base_url].some((s) => s.toLowerCase().includes(q))

  const visiblePresets =
    activeTab === CUSTOM_TAB
      ? []
      : (activeTab === ALL_TAB
          ? ALL_PRESETS
          : (GROUPS.find((g) => g.title === activeTab)?.presets ?? [])
        ).filter(hitPreset)
  const visibleCustom =
    activeTab === ALL_TAB || activeTab === CUSTOM_TAB ? customItems.filter(hitCustom) : []

  if (loading) {
    return (
      <div className="max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold">服务商</h1>
        <div className="mt-6 animate-pulse text-neutral-500">加载中…</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">服务商</h1>
          <p className="mt-1 text-sm text-neutral-500">预置主流模型服务商，点添加即可配置</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600">
              ⌕
            </span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setExpanded(null)
              }}
              placeholder="搜索服务商…"
              className="vm-input w-64 pl-8 pr-8"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-neutral-500 hover:text-neutral-300"
              >
                ✕
              </button>
            )}
          </div>
          <button onClick={() => setShowCustomModal(true)} className="vm-btn-primary shrink-0">
            ＋ 自定义
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
              setExpanded(null)
            }}
            className={`vm-chip ${activeTab === tab ? 'vm-chip-on' : 'vm-chip-off'}`}
          >
            {tab}
            {tab === CUSTOM_TAB && customItems.length > 0 && (
              <span className="ml-1 opacity-70">{customItems.length}</span>
            )}
          </button>
        ))}
      </div>

      {visiblePresets.length + visibleCustom.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-neutral-500">
            {q ? `没有匹配 “${query.trim()}” 的服务商` : '还没有自定义服务商（中转站 / 私有网关…）'}
          </p>
          <button
            onClick={() => setShowCustomModal(true)}
            className="mt-2 text-sm text-cyan-400 hover:underline"
          >
            ＋ 添加自定义服务商
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {visiblePresets.map((preset) => {
            const configured = findConfigured(preset)
            const isOpen = expanded === preset.name
            return (
              <PresetCard
                key={preset.name}
                preset={preset}
                configured={configured}
                isOpen={isOpen}
                onToggle={() => setExpanded(isOpen ? null : preset.name)}
                onDelete={configured ? (e) => handleDelete(configured, e) : undefined}
                onSaved={onSaved}
              />
            )
          })}
          {visibleCustom.map((p) => (
            <CustomCard
              key={p.id}
              provider={p}
              isOpen={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
              onDelete={(e) => handleDelete(p, e)}
              onSaved={onSaved}
            />
          ))}
        </div>
      )}

      {showCustomModal && (
        <Modal title="添加自定义服务商" onClose={() => setShowCustomModal(false)}>
          <InlineForm isCustom onCancel={() => setShowCustomModal(false)} onSaved={onSaved} />
        </Modal>
      )}
    </div>
  )
}

// ── 弹窗：遮罩 + 居中玻璃卡片 ──

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="vm-card w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4">
          <h3 className="font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-0.5 text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Logo({ src, mono }: { src: string; mono?: boolean }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
      <img src={src} alt="" className={`h-7 w-7 ${mono ? 'invert' : ''}`} />
    </div>
  )
}

// ── 预置服务商卡片（截图版式：logo 色块 + 徽标 + URL 芯片 + 官网/添加） ──

interface PresetCardProps {
  preset: Preset
  configured: Provider | null
  isOpen: boolean
  onToggle: () => void
  onDelete?: (e: React.MouseEvent) => void
  onSaved: () => void
}

function PresetCard({ preset, configured, isOpen, onToggle, onDelete, onSaved }: PresetCardProps) {
  return (
    <div
      className={`vm-card ${isOpen ? 'col-span-3' : ''} ${
        configured ? 'border-cyan-400/30 shadow-[0_0_16px_rgba(34,211,238,0.08)]' : ''
      }`}
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <Logo src={preset.logo} mono={preset.mono} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{preset.name}</span>
              <span className="shrink-0 rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400">
                {presetGroup(preset)}
              </span>
            </div>
            <div className="mt-0.5 truncate text-xs text-neutral-500">{preset.desc}</div>
          </div>
        </div>

        <div className="mt-4">
          <span className="vm-url">{preset.base_url.replace(/^https?:\/\//, '')}</span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <a
            href={preset.site}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-neutral-500 transition-colors hover:text-cyan-400"
          >
            官网
          </a>
          <div className="flex items-center gap-2">
            {configured && (
              <span className="rounded-full bg-cyan-400/10 px-2.5 py-0.5 text-xs text-cyan-300">
                {configured.enabled ? '已配置' : '已禁用'}
              </span>
            )}
            <button onClick={onToggle} className="vm-btn-neon">
              {isOpen ? '收起' : configured ? '编辑' : '添加'}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <InlineForm
          preset={preset}
          existing={configured}
          onCancel={onToggle}
          onDelete={onDelete}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

// ── 已保存的自定义服务商卡片 ──

interface CustomCardProps {
  provider: Provider
  isOpen: boolean
  onToggle: () => void
  onDelete: (e: React.MouseEvent) => void
  onSaved: () => void
}

function CustomCard({ provider, isOpen, onToggle, onDelete, onSaved }: CustomCardProps) {
  return (
    <div className={`vm-card border-violet-500/25 ${isOpen ? 'col-span-3' : ''}`}>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10 text-lg font-bold text-violet-300">
            {provider.name.slice(0, 1).toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{provider.name}</span>
              <span className="shrink-0 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-400">
                自定义
              </span>
            </div>
            <div className="mt-0.5 truncate text-xs text-neutral-500">
              {provider.default_model}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <span className="vm-url">{provider.base_url.replace(/^https?:\/\//, '')}</span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-neutral-600">{provider.enabled ? '已启用' : '已禁用'}</span>
          <button onClick={onToggle} className="vm-btn-neon">
            {isOpen ? '收起' : '编辑'}
          </button>
        </div>
      </div>
      {isOpen && (
        <InlineForm existing={provider} onCancel={onToggle} onDelete={onDelete} onSaved={onSaved} />
      )}
    </div>
  )
}

// ── 内联配置表单（预置卡片内展开 / 自定义弹窗内复用） ──

interface InlineFormProps {
  preset?: Preset
  existing?: Provider | null
  isCustom?: boolean
  onCancel: () => void
  onDelete?: (e: React.MouseEvent) => void
  onSaved: () => void
}

function InlineForm({ preset, existing, isCustom, onCancel, onDelete, onSaved }: InlineFormProps) {
  const [draft, setDraft] = useState<ProviderDraft>(() => {
    if (existing) {
      return {
        name: existing.name,
        kind: existing.kind,
        base_url: existing.base_url,
        api_key: '',
        default_model: existing.default_model,
        enabled: existing.enabled,
      }
    }
    if (preset) {
      return {
        name: preset.name,
        kind: preset.kind,
        base_url: preset.base_url,
        api_key: '',
        default_model: preset.default_model,
        enabled: true,
      }
    }
    return { name: '', kind: 'openai_compat', base_url: '', api_key: '', default_model: '', enabled: true }
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!confirmDel) return
    const t = setTimeout(() => setConfirmDel(false), 3000)
    return () => clearTimeout(t)
  }, [confirmDel])

  const needKey = preset ? preset.needKey : true
  const canSave = !!draft.name && (!!existing || !needKey || !!draft.api_key)

  const submit = () => {
    setSaving(true)
    const req = existing ? updateProvider(existing.id, draft) : createProvider(draft)
    req.then(onSaved).finally(() => setSaving(false))
  }

  const canTest = !!draft.base_url && (!!existing || !needKey || !!draft.api_key)

  const runTest = () => {
    setTesting(true)
    setTestResult(null)
    testProvider({
      kind: draft.kind,
      base_url: draft.base_url,
      api_key: draft.api_key,
      model: draft.default_model,
      provider_id: existing?.id,
    })
      .then(setTestResult)
      .catch((e) =>
        setTestResult({ success: false, message: String(e?.message ?? e), latency_ms: 0 }),
      )
      .finally(() => setTesting(false))
  }

  return (
    <div className="border-t border-white/5 px-5 pb-5 pt-4">
      <div className="grid grid-cols-2 gap-3">
        {isCustom && (
          <>
            <Field label="显示名称">
              <input
                className="vm-input"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="如：我的中转站"
                autoFocus
              />
            </Field>
            <Field label="类型">
              <select
                className="vm-select"
                value={draft.kind}
                onChange={(e) =>
                  setDraft({ ...draft, kind: e.target.value as ProviderDraft['kind'] })
                }
              >
                <option value="openai_compat">OpenAI 兼容</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </Field>
          </>
        )}
        <div className="col-span-2">
          <Field label={needKey ? 'API Key' : 'API Key（本地服务可留空）'}>
            <input
              type="password"
              className="vm-input"
              value={draft.api_key}
              onChange={(e) => setDraft({ ...draft, api_key: e.target.value })}
              placeholder={existing ? '留空则不修改' : needKey ? 'sk-...' : '无需填写'}
              autoFocus={!isCustom}
            />
          </Field>
        </div>
        <Field label="Base URL">
          <input
            className="vm-input"
            value={draft.base_url}
            onChange={(e) => setDraft({ ...draft, base_url: e.target.value })}
            placeholder="https://..."
          />
        </Field>
        <Field label="默认模型">
          <input
            className="vm-input"
            value={draft.default_model}
            onChange={(e) => setDraft({ ...draft, default_model: e.target.value })}
            placeholder="模型 ID"
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            启用
          </label>
          {existing && onDelete && (
            <button
              onClick={(e) => (confirmDel ? onDelete(e) : (e.stopPropagation(), setConfirmDel(true)))}
              className={`rounded-lg px-3 py-1 text-sm transition-colors ${
                confirmDel
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'text-red-400/70 hover:text-red-300'
              }`}
            >
              {confirmDel ? '确认移除？' : '移除配置'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {testResult && (
            <span
              className={`max-w-96 truncate text-xs ${
                testResult.success ? 'text-cyan-400' : 'text-red-400'
              }`}
              title={testResult.message}
            >
              {testResult.success ? '✓' : '✗'} {testResult.message}
              {testResult.latency_ms > 0 && ` (${(testResult.latency_ms / 1000).toFixed(1)}s)`}
            </span>
          )}
          <button onClick={runTest} disabled={!canTest || testing} className="vm-btn-neon">
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            取消
          </button>
          <button onClick={submit} disabled={!canSave || saving} className="vm-btn-primary">
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-400">{label}</label>
      {children}
    </div>
  )
}
