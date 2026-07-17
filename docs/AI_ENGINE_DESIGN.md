# AI 分析引擎 & 模型服务商配置模块 详细设计（V2 · 对齐 clawbox）

> 配套文档：[TECH_DESIGN.md](./TECH_DESIGN.md) §5.3
> **设计原则**：服务商配置直接参考本地 clawbox 项目的 `ModelProvider`，极简、够用、不过度设计。

---

## 一、模块全景（简化版）

```
┌──────────────────────────────────────────────────────────┐
│  第 0 层：模型服务商配置 (Provider Settings)               │
│  对齐 clawbox：ModelProvider { name, apiKey, baseUrl,      │
│                defaultModel, enabled }                     │
└───────────────────────┬──────────────────────────────────┘
                        ▼ 读取配置
┌──────────────────────────────────────────────────────────┐
│  第 1 层：Provider 抽象层 (LLM Provider)                   │
│  统一接口；OpenAI兼容走 openai SDK，Claude 走 anthropic SDK │
└───────────────────────┬──────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────┐
│  第 2 层：分析流水线 (Analysis Pipeline)                   │
│  任务携带 provider_id + model + template                  │
│  transcript → 切片 → 选模板 → 调用 → 解析存库              │
└──────────────────────────────────────────────────────────┘
```

**相比 V1 文档的删减**：
- ❌ 删掉 `routing_rules`（模板→模型映射表）—— 模板不绑模型。
- ❌ 删掉每模板主备链配置 —— 容错改成全局「备用服务商」一个开关。
- ❌ 删掉 provider 的 `models_json` 列表字段 —— 只留 `defaultModel`，要用别的模型新建任务时填。
- ❌ 删掉「拉取模型」按钮（V1）—— 新建任务时模型为文本输入框（可加下拉，但数据来自配置，不强依赖 `/v1/models`）。
- 🔁 apiKey 改为**明文存配置**（对齐 clawbox），`keyring` 列为 V2 安全增强。

---

## 二、第 0 层：模型服务商配置模块

### 2.1 数据模型（对齐 clawbox，只加最小必要字段）

```python
# videomind/models/provider.py
class ModelProvider(SQLModel, table=True):
    id: str = Field(primary_key=True)            # uuid
    name: str                                     # 显示名，如 "OpenAI 官方"
    kind: str = "openai_compat"                   # openai_compat | anthropic （只两类，见 §3.1）
    base_url: str                                 # https://api.openai.com/v1
    api_key: str = ""                             # 直接存（明文，对齐 clawbox）
    default_model: str = ""                       # 默认模型，如 gpt-4o
    enabled: bool = True
    created_at: datetime
    updated_at: datetime
```

> 与 clawbox `ModelProvider` 的字段一一对应：`name / apiKey / baseUrl / defaultModel / enabled`，仅多一个 `kind`（用来区分走 openai SDK 还是 anthropic SDK，见 §3.1）和审计时间戳。

**不再需要 `routing_rules` 表**。任务自己记录用哪个 provider+model。

### 2.2 配置怎么存

对齐 clawbox：配置整体是一个 JSON 对象，由后端读写。VideoMind AI 存 SQLite 的 `model_providers` 表（便于查询/关联任务），等价于 clawbox 的 IPC `get_config`/`set_config`。

**API Key 存储**（明确决策）：
- **V1：明文存 `model_providers.api_key`**（与 clawbox 一致，不阻塞主线）。
- **V2 安全增强**：迁移到 `keyring`（macOS Keychain / Windows Credential Manager / Linux SecretService），表里只留引用。届时写一次性迁移脚本。
- 前端表单：apiKey 用 `type=password` 不回显，编辑时留空表示不改（clawbox 就是这么做的）。

> 关于「Windows 有没有系统钥匙串」：有 —— Windows Credential Manager + DPAPI，`keyring` 库默认就用它。但 V1 不依赖它，明文存即可。

### 2.3 UI（对齐 clawbox 的 ModelConfig.svelte）

设置页 → 「🤖 模型服务商」：

```
┌─────────────────────────────────────────────────────────┐
│  模型服务商                              [ + 添加服务商 ]  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐    │
│  │ OpenAI 官方                       [编辑] [删除]   │    │
│  │ gpt-4o · https://api.openai.com/v1              │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Anthropic Claude                  [编辑] [删除]   │    │
│  │ claude-3-5-sonnet · https://api.anthropic.com   │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**添加/编辑弹窗**（字段与 clawbox 完全一致 + 一个 kind 下拉）：

| 字段 | 控件 |
|------|------|
| 服务商类型 (kind) | 下拉：OpenAI兼容 / Anthropic |
| 显示名称 | 文本 |
| API Key | password 输入 |
| Base URL | 文本（按 kind 预填默认） |
| 默认模型 | 文本（如 gpt-4o） |
| 启用 | 开关 |

> **不做**「测试连接」「拉取模型」按钮（V1）—— 新建任务时直接验证（调不通会报错，任务标 failed 并提示去设置页检查）。

### 2.4 配置 API（精简）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/settings/providers` | 列出 |
| POST | `/settings/providers` | 新增 |
| PUT | `/settings/providers/{id}` | 编辑 |
| DELETE | `/settings/providers/{id}` | 删除 |

> 删掉了 `/settings/routing`、`/settings/providers/{id}/test`、`/settings/providers/{id}/models`。

---

## 三、第 1 层：Provider 抽象层

### 3.1 为什么只有两类 kind

绝大多数模型都兼容 OpenAI 协议，所以 provider 的 `kind` 只需两种：

| kind | 用什么调 | 典型代表 |
|------|----------|----------|
| `openai_compat` | `openai` SDK（改 `base_url`） | OpenAI、通义(DashScope)、DeepSeek、Moonshot、智谱、Ollama、vLLM、OpenRouter、SiliconFlow |
| `anthropic` | `anthropic` SDK | Claude 系列 |

### 3.2 统一接口

```python
# videomind/core/analyzer/providers/base.py
class LLMProvider(Protocol):
    def chat(self, messages, *, model: str, temperature=0.3,
             max_tokens=None, response_format=None, timeout=120) -> ChatResult: ...
```

- `OpenAICompatProvider`：`openai.OpenAI(base_url=..., api_key=...)`，支持 `response_format={"type":"json_object"}`。
- `AnthropicProvider`：`anthropic.Anthropic(...)`，system 单独传，JSON 靠 prompt 约束。
- 内置指数退避重试（429/5xx，3 次）。

---

## 四、第 2 层：分析流水线（模型选择简化）

### 4.1 模型由谁决定 —— 任务自己带，不靠路由表

新建任务时，用户选择：

```
┌─ 新建分析任务 ──────────────────────────┐
│ 视频URL:  [_____________________]       │
│ 分析模板:  [商业模式分析          ▼]     │  ← 只决定 Prompt
│ 服务商:    [OpenAI 官方          ▼]     │  ← 选 provider
│ 模型:      [gpt-4o              ▼]      │  ← 默认填 provider.defaultModel，可改
│ ☑ 失败时使用备用服务商 (Claude)          │  ← 可选全局容错
└─────────────────────────────────────────┘
```

任务记录字段（`tasks.options` JSON）：
```json
{
  "provider_id": "uuid-1",
  "model": "gpt-4o",
  "template": "business",
  "fallback_provider_id": "uuid-2"   // 可空，全局备用
}
```

### 4.2 调用时序（Router 退化为「解析任务配置 + 一次容错」）

```
 [tasks/steps/analyze.py]
   ├─ 取 transcript 文本
   ├─ chunker.slice(text)          # 长文本切片
   ├─ provider = build_provider(tasks.options.provider_id)
   ├─ try:
   │     result = run_llm(provider, tasks.options.model, template, chunks)
   │  except ProviderError:
   │     if fallback_provider_id:
   │         provider2 = build_provider(fallback_provider_id)
   │         result = run_llm(provider2, default_model_of_fallback, template, chunks)
   │     else: raise → task failed
   ├─ pydantic 校验 JSON 输出（失败重试2次）
   └─ 写 analyses 表
```

> 「Router」不再是一张配置表，就是一个读任务配置 + 可选一次 fallback 的函数。复杂度从「5模板×N链」降到「主用+1备用」。

### 4.3 Prompt 模板系统（不变）

模板只决定 Prompt，与模型解耦：
```
prompts/business.j2   课程 / 爆款 / 摘要 / 要点 …
```
每个模板定义 `system + user + output_schema(JSON)`。

---

## 五、V1.0 落地清单（精简后）

后端：
- [ ] `models/provider.py`（SQLModel，对齐 clawbox 字段）+ 迁移
- [ ] `api/v1/providers.py`（CRUD 四个端点）
- [ ] `core/analyzer/providers/`：base / openai_compat / anthropic / factory
- [ ] `core/analyzer/chunker.py` + `prompts/*.j2` × 5
- [ ] `tasks/steps/analyze.py`：切片 → 调用 → JSON校验 → 可选 fallback

前端（对齐 clawbox ModelConfig.svelte）：
- [ ] 「模型服务商」列表 + 添加/编辑弹窗（6 字段 + kind）
- [ ] 「新建任务」表单：模板 + 服务商 + 模型 + 备用开关

---

## 六、与上一版（V1）的差异说明

| 维度 | V1（旧） | V2（本版，对齐 clawbox） |
|------|----------|---------------------------|
| Provider 字段 | 9 字段 + 模型列表 + 健康状态 | 6 字段（对齐 clawbox）|
| 路由 | `routing_rules` 表，5模板×主备链 | 删除；任务自带 provider+model，全局 1 个备用 |
| apiKey 存储 | 强制 keyring | 明文存（V1），keyring 留 V2 |
| 测试连接 / 拉取模型 | 有 | 无（V1），新建任务时自然验证 |
| Provider 类型 | 6 种预设 kind | 2 种：openai_compat / anthropic |

**TECH_DESIGN.md §5.3** 已指向本文档；数据模型无需再追加 `routing_rules`，只需 `model_providers` 一张表（见 §2.1）。
