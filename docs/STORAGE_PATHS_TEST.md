# 存储目录自定义 & 报告另存为 — 测试清单

> 对应功能：PRD §3.6 本地存储管理、§3.4 报告导出位置可配置。
> 覆盖：媒体目录自定义、报告目录自定义、报告「另存为」、老视频兼容性、边界异常。

## 0. 前置准备

```bash
# 后端（改了代码，需重启）
make server                       # 或重启 Tauri 应用（自动重启 sidecar）

# 前端依赖（新增 @tauri-apps/plugin-dialog）
cd apps/desktop/web && npm install

# 桌面端（首次会拉 tauri-plugin-dialog crate）
cd apps/desktop && npm run dev    # 调试；或 npm run build 打包
```

- 至少准备 1 个可采集的视频链接（YouTube/B站等）。
- 至少有 1 份**已完成的分析报告**才能测导出（需配好模型服务商并跑完采集→转录→分析）。
- 全功能验证需在 **Tauri 桌面端**（`tauri dev` 或打包产物）；纯浏览器（`make web`）无原生目录选择框。

---

## A. 设置页「存储目录」配置

### A1. 默认状态展示
1. 打开「设置」页。
2. **预期**：出现「存储目录」区，含「媒体目录」「报告目录」两行；各显示当前默认路径（媒体 = `…/media`，报告 = `~/Downloads`）；无「恢复默认」按钮（因未自定义）。
3. 下方「本地存储」区只读展示 `data_dir / media_dir / report_dir / subtitles_dir / cookies_dir`。

### A2. 自定义媒体目录
1. 点「媒体目录」行「更改」→ 弹出原生目录选择框。
2. 选一个目录（如新建 `~/vm-test-media`）→ 确认。
3. **预期**：媒体目录路径更新为所选目录；出现「恢复默认」按钮；顶部出现「已更新存储目录」提示。
4. 刷新页面，路径保持（已持久化）。

### A3. 恢复默认
1. 点「恢复默认」。
2. **预期**：媒体目录回到 `…/media`；「恢复默认」按钮消失；提示「已恢复默认目录」。

### A4. 报告目录同上（A2/A3 对报告目录重复一遍）

---

## B. 媒体目录生效（采集落盘）

### B1. 新视频落入自定义目录
1. 设置媒体目录为 `~/vm-test-media`。
2. 「新建任务」采集一个视频（勾选下载）。
3. **预期**：视频文件出现在 `~/vm-test-media/<视频ID>.<ext>`，**不在**默认 `…/media`。
4. 视频库列表该条 `media_path` 指向新目录；播放/提取音频/转录均正常。

### B2. 老视频兼容（关键）
1. 确保已有用**默认目录**下载的视频 V1（`…/media/xxx`）。
2. 把媒体目录改为 `~/vm-test-media`。
3. **预期**：V1 在视频库仍可正常播放、提取音频、转录；其文件仍在原 `…/media/xxx`（不迁移）。
4. 新采集的视频 V2 落入 `~/vm-test-media`。

### B3. 抽音频跟随
1. 对新目录里的视频点「提取音频」。
2. **预期**：生成的 `.wav` 与视频同在自定义媒体目录（`media_dir() / <id>.wav`）。

---

## C. 报告目录 & 另存为

### C1. 默认下载（未配报告目录）
1. 报告目录保持默认（`~/Downloads`）。
2. 进报告详情页，点 `PDF`。
3. **预期**：文件落入 `~/Downloads/<标题>_<模板>_<时间戳>.pdf`；提示「已保存：<文件名>」。MD/HTML 同理。

### C2. 配置报告目录后直接下载
1. 设置报告目录为 `~/vm-test-reports`。
2. 报告详情页点 `MD / HTML / PDF`。
3. **预期**：文件落入 `~/vm-test-reports/`（不在 `~/Downloads`）。

### C3. 另存为（不受默认目录约束）
1. 保持报告目录 = `~/vm-test-reports`。
2. 点「另存为…」→ 弹目录选择框 → 选 `~/Desktop`（或任意目录）。
3. **预期**：PDF 落入所选目录（`~/Desktop/...pdf`），**不**落入 `~/vm-test-reports`；提示「已保存到所选目录：<文件名>」。

### C4. 数据总表 CSV 跟随报告目录
1. 报告目录 = `~/vm-test-reports`。
2. 视频库点「导出 CSV」。
3. **预期**：`VideoMind数据表_<时间戳>.csv` 落入 `~/vm-test-reports/`。

---

## D. 边界与异常

### D1. 取消目录选择
1. 点「更改」→ 在原生弹窗点「取消」。
2. **预期**：路径不变；无错误提示；无「已更新」提示。

### D2. 「另存为」取消
1. 报告页点「另存为…」→ 取消选择。
2. **预期**：不产生文件；提示文字清空；无报错。

### D3. 不可写目录
1. 媒体目录选一个无权限目录（如 `/` 或只读位置）。
2. 采集新视频。
3. **预期**：采集失败时显示友好错误（而非崩溃）；改回可写目录后恢复正常。

### D4. 浏览器调试模式（make web）
1. 纯 `make web` 跑前端（非 Tauri）。
2. 进设置页「存储目录」区。
3. **预期**：「更改」按钮禁用；显示提示「开发模式（浏览器）不支持选择目录，打包为桌面应用后可用」。

### D5. 重启后配置保留
1. 自定义两个目录 → 完全退出应用 → 重新打开。
2. **预期**：两个自定义路径均保留（存于 `app_settings` 表）；新采集/导出仍用自定义目录。

---

## E. API 直连验证（curl，无需 UI）

> 假设后端跑在 `127.0.0.1:18791`。`<id>` 替换为实际 analysis id。

```bash
# 1. 读当前偏好（应含 media_dir / report_dir，初始为空串）
curl -s 127.0.0.1:18791/api/v1/settings/preferences | python -m json.tool

# 2. 设置自定义报告目录
curl -s -X PUT 127.0.0.1:18791/api/v1/settings/preferences \
  -H 'Content-Type: application/json' \
  -d '{"report_dir": "/tmp/vm-test-reports"}' | python -m json.tool

# 3. 看实际生效路径（media_dir / report_dir 应反映自定义值）
curl -s 127.0.0.1:18791/api/v1/system/paths | python -m json.tool

# 4. 导出报告到默认（自定义）目录
curl -s -X POST "127.0.0.1:18791/api/v1/reports/<id>/save?fmt=pdf" | python -m json.tool
#   预期 path 在 /tmp/vm-test-reports/

# 5. 另存为：用 ?dir= 临时指定（优先级最高）
curl -s -X POST "127.0.0.1:18791/api/v1/reports/<id>/save?fmt=pdf&dir=/tmp/vm-other" | python -m json.tool
#   预期 path 在 /tmp/vm-other/

# 6. 恢复默认
curl -s -X PUT 127.0.0.1:18791/api/v1/settings/preferences \
  -H 'Content-Type: application/json' -d '{"report_dir": ""}' | python -m json.tool
```

**媒体目录生效验证**（设置后采集，查 `media_path` 是否指向自定义目录）：
```bash
curl -s -X PUT 127.0.0.1:18791/api/v1/settings/preferences \
  -H 'Content-Type: application/json' -d '{"media_dir": "/tmp/vm-test-media"}'
# 之后新建采集任务，完成后：
curl -s "127.0.0.1:18791/api/v1/videos/<video_id>" | python -m json.tool
#   预期 media_path 以 /tmp/vm-test-media/ 开头
```

---

## F. 通过标准

全部满足即视为功能完成：
- [ ] A1–A4 设置页配置/恢复正常，刷新与重启后持久化
- [ ] B1 新视频落自定义目录；B2 老视频不受影响；B3 抽音频跟随
- [ ] C1 默认下载到 `~/Downloads`；C2 配置后到自定义目录；C3 另存为到任选目录；C4 CSV 跟随
- [ ] D1–D5 边界无崩溃、提示友好
- [ ] E 节 curl 全部返回预期路径

## 已知限制
- 仅 **媒体目录**与**报告目录**可自定义；封面/字幕/Cookie/数据库跟随 `data_dir`（设计如此，见 PRD §3.6）。
- 老视频不自动迁移（`media_path` 为绝对路径，仍可访问；如需迁移需手动操作）。
- 纯浏览器调试模式不支持原生目录选择（需 Tauri 桌面端）。
