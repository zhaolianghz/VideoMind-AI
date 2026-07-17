import { useEffect, useState } from 'react'
import { createProvider, deleteProvider, listProviders, updateProvider } from '../api/providers'
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

/** 预置服务商：卡片默认展示，点卡片展开填 API Key 即可用 */
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
}

interface Group {
  title: string
  presets: Preset[]
}

const GROUPS: Group[] = [
  {
    title: '国际',
    presets: [
      { name: 'OpenAI', logo: logoOpenai, mono: true, kind: 'openai_compat', base_url: 'https://api.openai.com/v1', default_model: 'gpt-5.5', desc: 'GPT 系列旗舰模型', needKey: true },
      { name: 'Anthropic Claude', logo: logoClaude, kind: 'anthropic', base_url: 'https://api.anthropic.com/v1', default_model: 'claude-sonnet-5', desc: 'Claude 系列模型', needKey: true },
      { name: 'Google Gemini', logo: logoGemini, kind: 'openai_compat', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', default_model: 'gemini-2.5-pro', desc: 'Gemini 多模态模型', needKey: true },
      { name: 'xAI Grok', logo: logoGrok, mono: true, kind: 'openai_compat', base_url: 'https://api.x.ai/v1', default_model: 'grok-4', desc: '马斯克家的模型', needKey: true },
      { name: 'Mistral', logo: logoMistral, kind: 'openai_compat', base_url: 'https://api.mistral.ai/v1', default_model: 'mistral-large-latest', desc: '欧洲开源之光', needKey: true },
      { name: 'Groq', logo: logoGroq, mono: true, kind: 'openai_compat', base_url: 'https://api.groq.com/openai/v1', default_model: 'llama-4-maverick', desc: 'LPU 极速推理', needKey: true },
      { name: 'Perplexity', logo: logoPerplexity, kind: 'openai_compat', base_url: 'https://api.perplexity.ai', default_model: 'sonar-pro', desc: '联网搜索问答', needKey: true },
      { name: 'Together AI', logo: logoTogether, kind: 'openai_compat', base_url: 'https://api.together.xyz/v1', default_model: 'meta-llama/Llama-4-Maverick', desc: '开源模型云', needKey: true },
      { name: 'Cohere', logo: logoCohere, kind: 'openai_compat', base_url: 'https://api.cohere.ai/compatibility/v1', default_model: 'command-a-03-2025', desc: 'RAG / 企业检索', needKey: true },
      { name: 'Azure OpenAI', logo: logoAzure, kind: 'openai_compat', base_url: 'https://{资源名}.openai.azure.com/openai/v1', default_model: 'gpt-5.5', desc: '微软云托管 GPT', needKey: true },
      { name: 'AWS Bedrock', logo: logoBedrock, kind: 'openai_compat', base_url: 'https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1', default_model: 'anthropic.claude-sonnet-5', desc: '亚马逊云模型仓', needKey: true },
    ],
  },
  {
    title: '国内',
    presets: [
      { name: 'DeepSeek', logo: logoDeepseek, kind: 'openai_compat', base_url: 'https://api.deepseek.com/v1', default_model: 'deepseek-chat', desc: 'V3 性价比之选', needKey: true },
      { name: '阿里通义千问', logo: logoQwen, kind: 'openai_compat', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', default_model: 'qwen-max', desc: '通义 Qwen 系列', needKey: true },
      { name: 'Moonshot Kimi', logo: logoKimi, kind: 'openai_compat', base_url: 'https://api.moonshot.cn/v1', default_model: 'kimi-k2', desc: '长上下文理解', needKey: true },
      { name: '智谱 GLM', logo: logoZhipu, kind: 'openai_compat', base_url: 'https://open.bigmodel.cn/api/paas/v4', default_model: 'glm-5', desc: 'GLM 系列模型', needKey: true },
      { name: 'MiniMax', logo: logoMinimax, kind: 'openai_compat', base_url: 'https://api.minimax.chat/v1', default_model: 'MiniMax-M3', desc: 'Agent 与多模态', needKey: true },
      { name: '字节豆包', logo: logoDoubao, kind: 'openai_compat', base_url: 'https://ark.cn-beijing.volces.com/api/v3', default_model: 'doubao-1.5-pro-32k', desc: '火山方舟引擎', needKey: true },
      { name: '百度文心', logo: logoWenxin, kind: 'openai_compat', base_url: 'https://qianfan.baidubce.com/v2', default_model: 'ernie-5.0', desc: '千帆 ERNIE 系列', needKey: true },
      { name: '腾讯混元', logo: logoHunyuan, kind: 'openai_compat', base_url: 'https://api.hunyuan.cloud.tencent.com/v1', default_model: 'hunyuan-turbos', desc: '腾讯云大模型', needKey: true },
      { name: '讯飞星火', logo: logoSpark, kind: 'openai_compat', base_url: 'https://spark-api-open.xf-yun.com/v1', default_model: '4.0Ultra', desc: '科大讯飞 Spark', needKey: true },
      { name: '阶跃星辰', logo: logoStepfun, kind: 'openai_compat', base_url: 'https://api.stepfun.com/v1', default_model: 'step-2-16k', desc: 'Step 系列模型', needKey: true },
      { name: '零一万物', logo: logoYi, kind: 'openai_compat', base_url: 'https://api.lingyiwanwu.com/v1', default_model: 'yi-lightning', desc: 'Yi 系列模型', needKey: true },
      { name: '百川智能', logo: logoBaichuan, kind: 'openai_compat', base_url: 'https://api.baichuan-ai.com/v1', default_model: 'Baichuan4-Turbo', desc: 'Baichuan 系列', needKey: true },
      { name: '商汤日日新', logo: logoSensenova, kind: 'openai_compat', base_url: 'https://api.sensenova.cn/compatible-mode/v1', default_model: 'SenseChat-5', desc: 'SenseNova 系列', needKey: true },
    ],
  },
  {
    title: '聚合平台',
    presets: [
      { name: 'OpenRouter', logo: logoOpenrouter, mono: true, kind: 'openai_compat', base_url: 'https://openrouter.ai/api/v1', default_model: 'anthropic/claude-sonnet-5', desc: '一个 Key 用遍全球模型', needKey: true },
      { name: '硅基流动', logo: logoSiliconcloud, kind: 'openai_compat', base_url: 'https://api.siliconflow.cn/v1', default_model: 'deepseek-ai/DeepSeek-V3', desc: '国产模型聚合', needKey: true },
      { name: 'AiHubMix', logo: logoAihubmix, kind: 'openai_compat', base_url: 'https://aihubmix.com/v1', default_model: 'gpt-5.5', desc: '国内可用的聚合中转', needKey: true },
    ],
  },
  {
    title: '本地部署',
    presets: [
      { name: 'Ollama（本地）', logo: logoOllama, mono: true, kind: 'openai_compat', base_url: 'http://localhost:11434/v1', default_model: 'llama4', desc: '免费本地运行，无需 Key', needKey: false },
      { name: 'LM Studio（本地）', logo: logoLmstudio, mono: true, kind: 'openai_compat', base_url: 'http://localhost:1234/v1', default_model: 'local-model', desc: '桌面端本地推理', needKey: false },
      { name: 'vLLM（自建）', logo: logoVllm, kind: 'openai_compat', base_url: 'http://localhost:8000/v1', default_model: 'Qwen/Qwen2.5-72B-Instruct', desc: '自建推理服务', needKey: false },
    ],
  },
]

const ALL_PRESETS = GROUPS.flatMap((g) => g.presets)

export function Providers() {
  const [items, setItems] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  /** 当前展开的卡片：预置名 / provider id / '__custom__' */
  const [expanded, setExpanded] = useState<string | null>(null)

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
    if (confirm(`移除「${p.name}」的配置？`)) {
      deleteProvider(p.id).then(() => {
        setExpanded(null)
        load()
      })
    }
  }

  const onSaved = () => {
    setExpanded(null)
    load()
  }

  if (loading) {
    return (
      <div className="max-w-5xl">
        <h1 className="mb-1 text-2xl font-bold">模型服务商</h1>
        <div className="mt-6 text-neutral-500">加载中…</div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">模型服务商</h1>
        <p className="text-sm text-neutral-500">点击卡片填入 API Key 即可使用</p>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title} className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-500">
            {group.title}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {group.presets.map((preset) => {
              const configured = findConfigured(preset)
              const key = preset.name
              const isOpen = expanded === key
              return (
                <PresetCard
                  key={key}
                  preset={preset}
                  configured={configured}
                  isOpen={isOpen}
                  onToggle={() => setExpanded(isOpen ? null : key)}
                  onDelete={configured ? (e) => handleDelete(configured, e) : undefined}
                  onSaved={onSaved}
                />
              )
            })}
          </div>
        </div>
      ))}

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-500">
          自定义
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {customItems.map((p) => (
            <CustomCard
              key={p.id}
              provider={p}
              isOpen={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
              onDelete={(e) => handleDelete(p, e)}
              onSaved={onSaved}
            />
          ))}
          <NewCustomCard
            isOpen={expanded === '__custom__'}
            onToggle={() => setExpanded(expanded === '__custom__' ? null : '__custom__')}
            onSaved={onSaved}
          />
        </div>
      </div>
    </div>
  )
}

function Logo({ src, mono, size = 'h-8 w-8' }: { src: string; mono?: boolean; size?: string }) {
  return <img src={src} alt="" className={`${size} shrink-0 ${mono ? 'invert' : ''}`} />
}

// ── 预置服务商卡片（可展开内联配置） ──

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
      className={`rounded-2xl border shadow-lg shadow-black/30 backdrop-blur-xl transition-colors ${
        isOpen ? 'col-span-2' : 'cursor-pointer'
      } ${
        configured
          ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-neutral-950/95 hover:border-emerald-400/60'
          : 'border-white/10 bg-gradient-to-br from-neutral-800/90 to-neutral-950/95 hover:border-white/25'
      }`}
      onClick={isOpen ? undefined : onToggle}
    >
      <div
        className={`flex items-center justify-between p-5 ${isOpen ? 'cursor-pointer pb-3' : ''}`}
        onClick={isOpen ? onToggle : undefined}
      >
        <div className="flex items-center gap-3">
          <Logo src={preset.logo} mono={preset.mono} />
          <div>
            <div className="font-semibold">{preset.name}</div>
            <div className="text-xs text-neutral-500">{preset.desc}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isOpen && (
            <span className="text-xs text-neutral-500">
              {configured ? configured.default_model : preset.default_model}
            </span>
          )}
          {configured ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-400">
              {configured.enabled ? '已配置' : '已禁用'}
            </span>
          ) : (
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-neutral-500">
              未配置
            </span>
          )}
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
    <div
      className={`rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/30 to-neutral-950/95 shadow-lg shadow-black/30 backdrop-blur-xl transition-colors hover:border-sky-400/50 ${
        isOpen ? 'col-span-2' : 'cursor-pointer'
      }`}
      onClick={isOpen ? undefined : onToggle}
    >
      <div
        className={`flex items-center justify-between p-5 ${isOpen ? 'cursor-pointer pb-3' : ''}`}
        onClick={isOpen ? onToggle : undefined}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛠️</span>
          <div>
            <div className="font-semibold">{provider.name}</div>
            <div className="max-w-72 truncate text-xs text-neutral-500">{provider.base_url}</div>
          </div>
        </div>
        <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs text-sky-400">
          自定义{!provider.enabled && ' · 已禁用'}
        </span>
      </div>
      {isOpen && (
        <InlineForm existing={provider} onCancel={onToggle} onDelete={onDelete} onSaved={onSaved} />
      )}
    </div>
  )
}

// ── 新增自定义服务商（虚线卡片） ──

function NewCustomCard({
  isOpen,
  onToggle,
  onSaved,
}: {
  isOpen: boolean
  onToggle: () => void
  onSaved: () => void
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed transition-colors ${
        isOpen
          ? 'col-span-2 border-sky-500/40 bg-gradient-to-br from-neutral-900/80 to-neutral-950/95'
          : 'cursor-pointer border-neutral-700 hover:border-neutral-500'
      }`}
      onClick={isOpen ? undefined : onToggle}
    >
      <div
        className={`flex items-center gap-3 p-5 text-neutral-500 ${isOpen ? 'cursor-pointer pb-3' : 'justify-center'}`}
        onClick={isOpen ? onToggle : undefined}
      >
        <span className="text-xl">＋</span>
        <span className="text-sm">自定义服务商（中转站 / 私有网关…）</span>
      </div>
      {isOpen && <InlineForm isCustom onCancel={onToggle} onSaved={onSaved} />}
    </div>
  )
}

// ── 内联配置表单（嵌在卡片里，不弹窗） ──

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

  const needKey = preset ? preset.needKey : true
  const canSave = !!draft.name && (!!existing || !needKey || !!draft.api_key)

  const submit = () => {
    setSaving(true)
    const req = existing ? updateProvider(existing.id, draft) : createProvider(draft)
    req.then(onSaved).finally(() => setSaving(false))
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
                className="vm-input"
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
              onClick={onDelete}
              className="text-sm text-red-400/70 transition-colors hover:text-red-300"
            >
              移除配置
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={!canSave || saving}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
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
