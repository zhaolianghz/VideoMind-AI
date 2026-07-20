# V4 账号监控 · 技术预案

> 状态：**预案（V4 启动时照此实施）**
> 依据：PRD V4.0 Agent 平台版（自动监控竞品账号、主动抓取并生成周报）+ 参考 [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) 的 Playwright 路线
> 编写：2024-07

---

## 一、背景与目标

### 1.1 痛点
V1–V3 的 VideoMind 是**单视频被动分析**（用户贴 URL → 分析）。但竞品情报的真实场景是：
- 持续关注 N 个竞品账号，**新视频自动入库分析**。
- 不仅看视频内容，还要看**评论**（用户痛点、销售线索）。
- 周期汇总成**周报**（这周竞品发了什么、讲了什么、用户反馈如何）。

### 1.2 为什么 yt-dlp 做不到
| 需求 | yt-dlp | 需要的能力 |
|------|--------|------------|
| 单视频下载 + 元数据 | ✅ | 已满足（V1 已做）|
| **账号主页全部视频列表** | ❌ | 平台 API（需登录态 + 签名）|
| **评论** | ❌（仅部分平台评论元数据）| 平台评论 API |
| **关键词搜索** | ❌ | 平台搜索 API |
| 会员/限制内容 | 需 cookie | 同样需登录态 |

→ 需要一个**能登录、能调平台私有 API**的爬虫层。**Playwright + 登录态** 是当前社区验证过最稳的方案（MediaCrawler 路线，无需 JS 逆向）。

### 1.3 V4 目标
- 订阅竞品/行业账号 → **定时自动爬新视频 + 评论** → 接入现有分析管线 → **周期生成周报**。
- 从评论中提取**销售线索 / 用户痛点**（PRD V4：结合 CRM）。

---

## 二、整体架构

```
┌──────────────────────────────────────────────────────────┐
│  调度器（APScheduler / Celery beat）                       │
│  每日/每周触发监控任务                                      │
└───────────────┬──────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────┐
│  Crawler 子系统（新增 · Playwright）                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ 登录态管理   │  │ 账号主页爬取  │  │ 评论爬取         │  │
│  │ storage_state│ │ 视频列表+增量 │  │ 翻页+去重        │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │
│         │ Playwright 拿登录态 + 签名 → httpx 调平台 API    │
└─────────┼─────────────────┼───────────────────┼──────────┘
          ▼                 ▼                   ▼
   WatchedAccount       新 Video 入库       Comment 入库
          │                 │                   │
          │        ┌────────▼────────┐          │
          │        │ 复用 V1 管线     │          │
          │        │ 采集→ASR→AI分析  │          │
          │        └────────┬────────┘          │
          │                 ▼                   │
          │           Analysis 结果              │
          │                 │                   │
          └────────┬────────┴───────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────┐
│  周报引擎（新增）                                          │
│  汇总周期内：视频分析 + 评论洞察 → LLM 生成结构化周报       │
└──────────────────────────────────────────────────────────┘
```

---

## 三、核心技术决策

### 3.1 为什么是 Playwright（而非纯 httpx 逆向）
| 方案 | 代价 | 结论 |
|------|------|------|
| 纯 httpx + JS 逆向（手撕 x-bogus/a_bogus 签名）| 签名算法频繁变，维护地狱 | ❌ |
| **Playwright 真实浏览器 + 登录态** | 重（要跑浏览器），但**无需逆向**，签名由浏览器自身生成 | ✅ 选这个 |
| 抓包代理（res-downloader 路线）| 被动捕获，无法主动按账号/定时爬 | ❌ 不匹配 |

**Playwright 模式**（抄 MediaCrawler）：
1. Playwright 启动有头浏览器 → 用户手动登录（扫码/账密）→ `context.storage_state()` 持久化 cookie + localStorage。
2. 后续爬取：`browser.new_context(storage_state=...)` 复用登录态 → 访问平台页面 → **在浏览器上下文里执行 JS 表达式**拿到带签名的请求参数 → 用 httpx 带这些参数直接调平台 API（快、可并发）。
3. 登录态过期 → 检测 → 提示用户重新登录。

> 关键：签名由浏览器 JS 自己算（真实环境），我们不碰逆向。这是 MediaCrawler 能长期维护的根本原因。

### 3.2 调度器选型
- **APScheduler**（轻量，进程内）：单机桌面版首选，随 sidecar 启动。
- Celery beat（V3 若已上 Celery）：多机/企业版再用。
- V4 单机版先用 **APScheduler**，与 sidecar 同进程。

### 3.3 浏览器打包（最大挑战）
Playwright 需要浏览器二进制（Chromium ~150MB）。塞进 sidecar 会让安装包爆炸（当前 97M → 250M+）。三个方案：

| 方案 | 说明 |取舍 |
|------|------|-----|
| **A 连接系统浏览器** | Playwright `channel="chrome"` 连用户机器已装的 Chrome/Edge | ✅ 推荐（零体积增量）|
| B 打包 Chromium | `playwright install chromium` 进资源 | 包太大 |
| C 首次启动下载 | 类似 whisper 模型，首次用时下载 | 体验差 |

→ **选 A**：sidecar 不打包浏览器，运行时连接用户系统的 Chrome（绝大多数机器都有）。无 Chrome 时提示安装或降级。

---

## 四、核心模块设计

### 4.1 登录态管理（`core/crawler/auth.py`）
```python
# 伪代码
async def ensure_login(platform: str) -> str:
    """确保某平台已登录，返回 storage_state 路径。"""
    state_path = cookies_dir() / f"{platform}.state.json"
    if state_path.exists() and not is_expired(state_path):
        return state_path
    # 无登录态 / 过期 → 弹有头浏览器让用户登录
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=False)
        ctx = await browser.new_context()
        await ctx.goto(platform_login_url(platform))
        # 等待用户登录成功（检测登录后特征元素 / URL 跳转）
        await wait_for_login_success(ctx, platform)
        await ctx.storage_state(path=state_path)
    return state_path
```
- 登录态文件：`~/.videomind/crawler/{platform}.state.json`
- 过期检测：定期试调一个需登录的 API，401/403 则标过期。
- 重新登录：前端提示「XX 平台登录态失效，点击重新登录」→ 触发有头浏览器。

### 4.2 账号主页爬取（`core/crawler/account.py`）
```python
async def crawl_account_videos(account: WatchedAccount) -> list[VideoMeta]:
    """爬某账号主页的全部视频元数据（增量）。"""
    state = await ensure_login(account.platform)
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=True)
        ctx = await browser.new_context(storage_state=state)
        page = await ctx.new_page()
        await page.goto(account.profile_url)
        # 滚动加载 + 在浏览器内执行 JS 取签名 → 调 API 拿视频列表
        videos = await extract_videos_via_api(ctx, account)
    return videos
```
- **增量**：对比 `videos.source_id` 已存在集合，只返回新增。
- 翻页：平台 API 游标 / 滚动加载。

### 4.3 评论爬取（`core/crawler/comments.py`）
- 同样 Playwright + httpx 调评论 API。
- 翻页去重，存 `Comment` 表。
- 每条评论后续送 LLM 做情感/线索打分。

### 4.4 增量监控调度（`services/monitor.py`）
```python
def run_monitor_cycle():
    for account in enabled_accounts():
        try:
            new_videos = crawl_account_videos(account)
            for v in new_videos:
                # 自动接入现有 V1 管线（collect → ASR → analyze）
                enqueue_pipeline(v)  # 复用 services/pipeline.run_collect 等
            crawl_comments_for(account)  # 评论
            account.last_crawled_at = now()
        except Exception as e:
            log(e); account.consecutive_failures += 1
```
- APScheduler `cron` 触发（每账号可配频率）。
- 连续失败 N 次 → 自动暂停 + 告警（登录态失效/反爬）。

### 4.5 周报引擎（`core/reporter/weekly.py`）
- 输入：某周期 `[start, end]` + 监控账号集合。
- 汇总：该周期所有新视频的 Analysis + 评论情感/线索。
- LLM（复用 analyzer 的多 Provider）按「竞品周报」模板生成：
  - 本周各账号发了什么、主推什么
  - 内容趋势 / 共性话题
  - 评论里的用户痛点 / 销售线索（聚类）
  - 对我方的建议
- 输出 MD/PDF（复用现有 reporter）。

---

## 五、数据模型（新增表）

```sql
-- 监控账号
CREATE TABLE watched_accounts (
    id            TEXT PRIMARY KEY,
    platform      TEXT NOT NULL,          -- bilibili/douyin/...
    account_id    TEXT,                   -- 平台账号 ID
    account_name  TEXT,
    profile_url   TEXT NOT NULL,
    crawl_freq    TEXT DEFAULT 'daily',   -- daily/weekly
    enabled       INTEGER DEFAULT 1,
    last_crawled_at DATETIME,
    consecutive_failures INTEGER DEFAULT 0,
    created_at    DATETIME
);

-- 爬取历史（每次监控周期一条）
CREATE TABLE crawl_logs (
    id             TEXT PRIMARY KEY,
    account_id     TEXT REFERENCES watched_accounts(id),
    crawled_at     DATETIME,
    new_video_count INTEGER,
    status         TEXT,                  -- ok/failed
    error          TEXT
);

-- 评论
CREATE TABLE comments (
    id            TEXT PRIMARY KEY,
    video_id      TEXT REFERENCES videos(id),
    author        TEXT,
    content       TEXT,
    likes         INTEGER,
    posted_at     DATETIME,
    sentiment     TEXT,                   -- positive/neutral/negative (LLM 标注)
    lead_score    REAL,                   -- 销售线索分（0-1，LLM）
    created_at    DATETIME
);

-- 周报
CREATE TABLE weekly_reports (
    id            TEXT PRIMARY KEY,
    period_start  DATE,
    period_end    DATE,
    account_ids_json TEXT,
    summary_json  TEXT,                   -- LLM 结构化输出
    created_at    DATETIME
);
```

---

## 六、API 设计（新增，前缀 `/api/v1`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/watched-accounts` | 订阅管理 |
| POST | `/watched-accounts/{id}/crawl` | 手动触发一次爬取 |
| POST | `/crawler/login/{platform}` | 触发有头浏览器登录 |
| GET | `/crawler/login/{platform}/status` | 登录态是否有效 |
| GET | `/comments?video_id=` | 视频评论 |
| GET | `/reports/weekly?period=` | 周报列表/详情 |
| POST | `/reports/weekly/generate` | 手动生成某周期周报 |

---

## 七、前端（新增页面）

- **📊 竞品监控**（新 sidebar 项）：
  - 订阅账号列表（增删、设频率、最近爬取状态）
  - 登录态管理（各平台绿/红指示 + 重新登录按钮）
- **📅 监控周报**：
  - 周期列表 + 周报详情（复用 ParsedView 渲染）
  - 评论线索视图（按 lead_score 排序的高价值评论）

---

## 八、反爬与合规

### 8.1 反爬
- 登录态（真实浏览器上下文，最稳）。
- 模拟人类：随机延迟、滚动节奏、并发限制（每账号串行，全局 ≤3）。
- **IP 代理池**（可选，PRD 提了）：接代理服务商 API，按请求轮换。V4.3+ 考虑。
- 频率克制：默认 daily，不过频。

### 8.2 合规（重要）
- 仅采集**公开可见**数据（不绕过隐私设置）。
- 评论/内容版权归平台/作者，**仅内部分析、不分发**，UI 注明来源。
- 各平台 ToS 多禁止自动化抓取 → **风险用户自担**，产品定位为"个人/企业内部情报工具"，不做公开 SaaS（规避）。
- 提供"仅分析用户授权内容"的合规模式开关。

---

## 九、落地分阶段（V4.x）

| 阶段 | 交付 | 验证 |
|------|------|------|
| **V4.1** 登录态 + 单账号主页爬取 | Playwright 登录某平台、storage_state 持久化、爬一个账号视频列表 + 增量 | 手动触发能爬到新视频 |
| **V4.2** 调度 + 自动管线串联 | APScheduler 定时 + 新视频自动进 V1 分析管线 | 订阅账号后，新视频次日自动分析完 |
| **V4.3** 评论爬取 + LLM 洞察 | 评论入库 + 情感/线索 LLM 打分 | 评论列表带情感标签 + 线索排序 |
| **V4.4** 周报生成 + UI | 周报引擎 + 订阅/周报前端 | 一键生成本周竞品周报 PDF |

每阶段独立可验证，V4.1 是地基（登录态 + 爬取），最关键也最难。

---

## 十、风险清单

| 风险 | 应对 |
|------|------|
| 平台反爬升级 / 签名变化 | Playwright 真实浏览器扛大部分；失效时切 MediaCrawler 更新 |
| 登录态频繁过期 | 检测 + 提示重登；storage_state 尽量复用 |
| 浏览器依赖（用户无 Chrome） | 首次检测，引导安装 / 降级 yt-dlp 单视频模式 |
| Playwright 跨平台打包 | 选 A（连系统浏览器），不打包 Chromium |
| 合规/法律 | §8.2，仅公开数据 + 内部使用 + 免责声明 |
| 评论量大 LLM 成本 | 评论先去重/聚类，只对代表性评论跑 LLM |

---

## 十一、与现有架构的集成点

- **复用**：`services/pipeline.py`（视频分析管线）、`core/analyzer/`（LLM 多 Provider）、`core/reporter/`（MD/PDF 导出）、Provider 配置。
- **新增**：`core/crawler/`（Playwright 子系统）、`services/monitor.py`（调度）、`models/{watched_account,crawl_log,comment,weekly_report}.py`、`api/v1/{watched_accounts,crawler,comments,weekly}.py`。
- **依赖**：`pip install playwright`（+ 首次 `playwright install chromium` 或连系统 Chrome）。

---

## 十二、何时启动

- V1.0 已发 → V2（多模态/PPT/思维导图/知识库）→ V3（企业版）→ **V4 启动本预案**。
- V4.1 可作为独立 spike 先验证（Playwright 登录态 + 单账号爬取可行性），不必等 V3 全完成。
