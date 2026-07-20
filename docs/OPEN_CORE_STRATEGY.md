# VideoMind AI · 开源与商业化策略（Open-Core）

> 状态：**策略草案，待决策**
> 模式：Open-Core 双轨制（CE 开源 + EE 商业）
> 参考：GitLab CE/EE、Mattermost、Sentry、Posthog

---

## 一、模式概述

```
┌─────────────────────────────────────────────────┐
│  开源版 CE（GitHub 公开，免费）                   │
│  核心管线：采集 → ASR → AI分析 → MD/PDF报告 → 桌面壳 │
│  目标：获客、传播、社区、建立技术信任               │
└───────────────────────┬─────────────────────────┘
                        │ 共享核心代码
                        ▼
┌─────────────────────────────────────────────────┐
│  商业版 EE（私有仓库，付费）                      │
│  增值：知识库RAG / PPT / 思维导图 / OCR /         │
│       企业（团队/私有/API） / Agent监控 / 授权激活  │
│  目标：变现（订阅 + 企业年费）                     │
└─────────────────────────────────────────────────┘
```

**原则**：开源的是「能跑通全链路的核心工具」，商业的是「让企业离不开的增值与基础设施」。绝不把核心功能锁起来 —— 锁核心会毁掉传播。

---

## 二、License 策略（⚠️ 关键决策 1）

| 方案 | 开源 License | 商业版 | 传播 | 防竞品 SaaS | 企业采用 |
|------|--------------|--------|------|-------------|----------|
| **A（推荐）** | **Apache 2.0** | 独立商业 License | ⭐⭐⭐⭐⭐ | 弱（竞品可 fork） | ⭐⭐⭐⭐⭐ 无忌讳 |
| B | AGPL-3.0 | 双 License（免 AGPL） | ⭐⭐⭐ | **强**（SaaS 必开源） | ⭐⭐ 企业忌 AGPL |
| C | MIT | 独立商业 License | ⭐⭐⭐⭐⭐ | 弱 | ⭐⭐⭐⭐⭐ |

### 推荐：**Apache 2.0**
- **理由**：宽松 + 专利保护条款 + 企业零忌讳 → 最大化传播与采用；商业版靠**增值功能**而非 license 限制变现。
- **竞品 fork 风险**：确实存在（别人拿代码做竞品）。但 open-core 的护城河本来就不在代码（代码可抄），而在**数据飞轮 + 企业知识图谱 + 持续迭代 + 品牌/支持**（PRD §8.2 已点明）。代码开源换来的传播与社区，远大于 fork 损失。
- **商业版保护**：EE 代码私有 + 单独 EULA，不开源。用户用 EE 功能需购买。

> AGPL 看似保护强，但会让银行/国企/大企业（你的高客单客户）因合规顾虑拒绝采用 —— 得不偿失。

---

## 三、功能边界（⚠️ 关键决策 2）

### CE 开源版（永远免费）
| 模块 | 包含 |
|------|------|
| 采集 | yt-dlp 6 平台 + 批量 + Cookie |
| ASR | faster-whisper（本地）|
| AI 分析 | 多 Provider + 5 模板 + map-reduce |
| 报告 | Markdown + PDF + HTML |
| 桌面应用 | Tauri 全功能包 |
| 基础 i18n / 测试 / 结果页分栏 | ✅ |

### EE 商业版（付费，按 PRD 定价分层）
| 模块 | 个人版 ¥39-99/月 | 专业版 ¥299/月 | 企业版 ¥9999+/年 |
|------|------------------|----------------|-------------------|
| 核心管线（CE 已有）| ✅ | ✅ | ✅ |
| **知识库 RAG**（Chroma + 智能问答）| ❌ | ✅ | ✅ |
| **PPT 汇报 + 思维导图** | ❌ | ✅ | ✅ |
| **多模态 OCR**（关键帧）| ❌ | ✅ | ✅ |
| **账号监控 Agent**（V4，竞品周报）| ❌ | 限量 | ✅ |
| **授权激活 / license 管理** | ❌ | ✅ | ✅ |
| 多账号协同 / 权限 | ❌ | ❌ | ✅ |
| 私有化部署 / API 开放平台 | ❌ | ❌ | ✅ |
| CRM 线索 / 行业模型微调 | ❌ | ❌ | ✅ |
| 官方支持 / SLA | 社区 | 邮件 | 专属 + SLA |

**划线原则**：
- 个人创作者用 CE 就够（建立口碑）。
- 专业研究员/团队需 RAG/PPT/OCR → 买专业版。
- 企业市场部需协同/私有/API/监控 → 买企业版。

---

## 四、技术结构

### 方案：单仓库 + Feature Flag（推荐）
```
VideoMind-AI/  (开源仓库)
├── 核心（CE，Apache 2.0）
│   ├── 采集/ASR/分析/报告/桌面壳/i18n/测试
│   └── feature_flag: ENTERPRISE=false（默认）
│
└── ee/  (商业模块目录，单独 license，不开源)
    ├── ee/knowledge/      (RAG，不开源)
    ├── ee/pptx/           (PPT，不开源)
    ├── ee/license/        (授权激活)
    └── ee/enterprise/     (团队/API)
```

- 开源仓库默认 `ENTERPRISE=false`，`ee/` 目录在公开仓库里**不存在**（或为空 stub）。
- 商业构建时：引入私有 `ee/` 子模块 + 编译 flag 开启。
- 运行时：CE 检测到无 license → EE 功能入口灰显「升级专业版」。

**好处**：核心一份代码，维护简单；商业功能隔离清晰；CE 用户零感知。

### 替代：双仓库
- `VideoMind-AI`（公开）+ `VideoMind-AI-EE`（私有，git submodule 引核心）。
- 隔离更彻底，但同步核心麻烦。团队大时再用。

---

## 五、开源准备清单（立即执行）

### 5.1 代码与合规
- [ ] **License 文件**：加 `LICENSE`（Apache 2.0）
- [ ] **源码 header**（可选）：每个 .py/.tsx 顶部加 `# SPDX-License-Identifier: Apache-2.0`
- [ ] **敏感信息清理**：grep 全仓库 + git 历史，确认无 API key / 私人 URL / 内部凭证（之前测试的 MiniMax key 在对话里没进代码，但要复查 git log）
- [ ] **第三方依赖审计**：yt-dlp(Unlicense)/FFmpeg(LGPL/GPL!)/faster-whisper(MIT)/openai(MIT)/anthropic(MIT)/weasyprint(BSD)/Tauri(Apache/MIT) —— 注意 **FFmpeg 是 LGPL/GPL**，分发时需声明（用动态链接 + 声明，或提示用户自带）
- [ ] **README**：英文化 + 截图 + Quick Start + 功能列表 + 链接到商业版
- [ ] `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `SECURITY.md`

### 5.2 质量与 CI
- [ ] **GitHub Actions CI**：push 跑 pytest（已有 25 测试）+ tsc build + ruff lint
- [ ] **Release**：GitHub Releases 附带 .dmg（mac）/ 引导 Win 构建
- [ ] **Issue/PR 模板**

### 5.3 文档（已有基础）
- [ ] docs/ 已有 PRD / TECH_DESIGN / AI_ENGINE / UI_PLAN / V4_PLAN —— 开源前补：
  - 英文 README（国际传播）
  - 架构图（首屏）
  - 商业版对比页（引导升级）

### 5.4 FFmpeg 合规（重点）
FFmpeg 默认 LGPL（动态链接 OK，需声明）或 GPL（传染）。VideoMind 通过 subprocess 调系统 ffmpeg（不静态链接）→ **不传染**，但分发时需：
- 声明使用了 FFmpeg
- 提供 FFmpeg 源码链接（LGPL 要求）
- 或安装时提示用户自行装 ffmpeg（当前 sidecar 不打包 ffmpeg，用户系统装）→ 最稳妥

---

## 六、商业版 license / 激活（对应之前 A/B/C）

商业版（EE）需要授权激活。推荐 **方案 A 离线机器码**：
- 生成机器指纹（mac: IOPlatformUUID / win: MachineGuid / linux: /etc/machine-id）
- 用户付费 → 你用私钥签发「激活码」（绑定机器指纹 + 功能位 + 有效期）
- EE 启动时本地验签 → 解锁对应功能
- **无需联网激活**（离线可用），破解需逆私钥（Ed25519）

> 这部分代码在 `ee/license/`（私有），CE 不含。

---

## 七、风险与对策

| 风险 | 对策 |
|------|------|
| 竞品 fork 做竞品 | 护城河在数据/知识图谱/迭代/品牌，不在代码（§2 已述）|
| 用户拿 CE 做商业用途 | Apache 2.0 允许；但他们缺 EE 增值，自然会升级 |
| FFmpeg license 纠纷 | subprocess 调用不传染 + 声明 + 用户自带 |
| 双轨维护成本 | 单仓库 + feature flag，核心一份 |
| 开源后 key 泄露 | git 历史审查 + .env 不入库 + key 轮换 |

---

## 八、落地步骤（建议顺序）

1. **【本周】开源准备**：License + README 英文化 + 敏感清理 + CI
2. **【确认】License 定 Apache 2.0 + 功能边界定稿**
3. **【本月】** GitHub 公开 + Release v1.0.1（首个开源 release）
4. **【之后】** 商业版 EE 仓库搭建（feature flag 结构）+ 开始做 RAG/PPT（V2）
5. 商业版官网 + 定价页 + license 激活系统

---

## 九、待你拍板

1. **License**：Apache 2.0（推荐）/ AGPL-3.0 / MIT ？
2. **功能边界**：CE/个人/专业/企业 的划分（§3 表格）认可吗？哪些功能必须留在 CE？
3. **技术结构**：单仓库 feature flag（推荐）/ 双仓库？
4. **首发节奏**：先开源 CE（v1.0.1）跑起来，再做 EE？还是 EE 先行？

定下来我就开始执行开源准备（LICENSE / README / 清理 / CI）。
