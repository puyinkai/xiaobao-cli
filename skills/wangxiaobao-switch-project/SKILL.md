---
name: wangxiaobao-switch-project
description: |
  查询和切换旺小宝项目。展开当前账号下所有租户与项目，让用户选择，然后调
  `xiaobao_switch_project` tool 把选中条目持久化到 plugin 全局激活项目状态文件
  `~/.openclaw/state/wangxiaobao/active-project.json`（权限 0600）。后续所有
  需要 tenant/project 上下文的 tool（list-audio / quick-qa 等）
  都从这个文件读取，**不再需要传 tenantId/projectId 入参**。

  **当以下情况时使用此 Skill**:
  (1) 用户提到"切换项目"、"选项目"、"换项目"、"项目列表"、"选择租户和项目"
  (2) 任意 tool 返回 `error: 'NO_ACTIVE_PROJECT'` —— 这是 plugin 的标准
      未激活信号，要求重新走切换项目流程
  (3) 用户准备同步录音 / 出报告 / 调旺小宝租户隔离 API，但还没设置过激活项目
  (4) 用户想看自己有权限访问哪些租户和项目
  (5) 用户直接点名某个项目（"切到XX项目"）—— 带 keyword 精确收敛后再确认
---

> **Host-agnostic CLI skill** — 本 skill 假设 `xiaobao-cli` 已装到 PATH
> (`npm i -g @puyinkai/xiaobao-cli` 或 `npx -y @puyinkai/xiaobao-cli`)。
> Agent 通过 shell 工具（Bash / Run / Shell）执行命令、读 **stdout JSON** 消费；
> stderr 是进度/错误提示。退出码 0 = 成功，非 0 = 业务/网络错（错误对象同时打到 stdout 可解析）。
>
> CLI 14 个子命令跟 openclaw-xiaobao plugin 14 个 tool **1:1 等价**，返回 JSON
> 结构完全一致（`{status, ok, data: {...}}`）。skill 里看到的 `resp.data.data.xxx`
> 取数路径直接对 stdout JSON 用 `jq` / `JSON.parse` 即可。
>
> **plugin tool → CLI 命令翻译表（数组参数走逗号分隔）**：
>
> | plugin tool | CLI 命令 |
> | --- | --- |
> | `xiaobao_authorize { force? }` | `xiaobao-cli auth login [--force]` |
> | `xiaobao_whoami` | `xiaobao-cli auth whoami` |
> | `xiaobao_logout` | `xiaobao-cli auth logout` |
> | `xiaobao_list_projects { keyword? }` | `xiaobao-cli project list [--keyword <kw>]` |
> | `xiaobao_switch_project { tenantId, tenantName, projectId, projectName }` | `xiaobao-cli project use --tenant-id ... --tenant-name ... --project-id ... --project-name ...` |
> | `xiaobao_list_consultants` | `xiaobao-cli consultant list` |
> | `xiaobao_list_audio { fromDate, toDate, userId?, userIdList?, page, size }` | `xiaobao-cli audio list --from "..." --to "..." [--user-id ...] [--user-id-list a,b,c] [--page N] [--size N]` |
> | `xiaobao_get_audio_text { audioId }` | `xiaobao-cli audio text <audioId>` |
> | `xiaobao_list_customers { ... }` | `xiaobao-cli customer list [--user-id] [--user-name] [--customer-name] [--customer-phone] [--portrait] [--from] [--to] [--page] [--size]` |
> | `xiaobao_list_visits { ... }` | `xiaobao-cli visit list [--customer-id] [--customer-name] [--from] [--to] [--page] [--size]` |
> | `xiaobao_list_customer_focus { visitIds, customerIds, audioIds, category, classification, fromDate, toDate, ... }` | `xiaobao-cli focus list [--visit-ids a,b] [--customer-ids a,b] [--audio-ids a,b] [--category ...] [--classification ...] [--from ...] [--to ...]` |
> | `xiaobao_list_customer_resistance { ... }` | `xiaobao-cli resistance list [同 focus]` |
> | `xiaobao_quick_qa { prompt, threadId? }` | `xiaobao-cli qa "<prompt>" [--thread-id ...]` |
> | `xiaobao_api { method, path, query, body, headers }` | `xiaobao-cli api <METHOD> <PATH> [--query k=v] [--body '<json>'] [--headers k=v]` |
>
> 用 `--format toon` 切到 TOON（uniform 数组省 30-50% token，LLM 上下文优化）；
> 用 `--format json`（默认）保持 JSON。state 路径：`~/.xiaobao/`（fallback 读 `~/.openclaw/state/wangxiaobao/`）。


# 旺小宝项目切换

把当前账号下的「租户 + 项目」枚举出来让用户挑一个，确认后调
`xiaobao_switch_project` tool 写入 plugin 全局状态文件，供后续 tool 读取。

## 执行前必读

- 必须先通过 `xiaobao_authorize` 完成 OAuth 登录；token 没拿到时本 skill 不能继续
- **不要**自己 fs.writeFile 写 `.env` 或任何文件——状态落地走
  `xiaobao_switch_project` tool，由 plugin 统一管理权限和路径
- 多个项目时**必须让用户挑**，绝对不要自动选择第一个；只有一个项目时才可以自动选
- 用户确认前不要调 switch-project tool

---

## 流程

### 第 1 步：拿到项目列表

调用 plugin tool `xiaobao_list_projects`。**可选 `keyword` 参数**对租户名/
项目名做包含模糊过滤（大小写不敏感）：

- 用户已经说了想要哪个项目（如"切到盛世禧悦"）→ **直接带 `keyword`**：
  `xiaobao_list_projects { keyword: "盛世禧悦" }`，收敛后通常只剩 1-2 条，
  省去让用户从一长串里挑
- 用户只说"换个项目""看看有哪些" → 不带 keyword，拉全量
- 账号项目很多、全量列表太长 → 提示用户给个关键字，再带 `keyword` 重查

返回结构：
```json
{
  "projects": [
    { "tenantId": "1234", "tenantName": "示例租户A", "projectId": "9001", "projectName": "示例项目甲" },
    { "tenantId": "1234", "tenantName": "示例租户A", "projectId": "9002", "projectName": "示例项目乙" },
    { "tenantId": "5678", "tenantName": "示例租户B", "projectId": "9101", "projectName": "示例项目丙" }
  ],
  "count": 3
}
```

如果 `count == 0`：

- **带了 `keyword`** → 是关键字没命中，不是没权限。提示用户换更短的关键字、
  或不带 keyword 看全量；**不要**直接说"没有项目"
- **没带 `keyword`** → 账号确实没有可访问的项目，结束

如果 tool 报错（401 / token 过期等），先调 `xiaobao_authorize { force: true }` 重新登录，再重试一次。

### 第 2 步：展示并让用户选

按"租户 → 项目"分组渲染，编号从 1 开始：

```
[示例租户A]
  1. 示例项目甲 (projectId=9001)
  2. 示例项目乙 (projectId=9002)

[示例租户B]
  3. 示例项目丙 (projectId=9101)
```

- **多个项目**：让用户回复编号或项目名。用户回复后，**再显示一次「即将激活的
  租户/项目信息」并请用户确认 y/n**，确认后才调 `xiaobao_switch_project` tool
- **仅一个项目**：直接告诉用户"账号下只有一个项目 X，是否激活？"等用户确认即可

### 第 3 步：调 `xiaobao_switch_project` tool 落地

```json
{
  "tenantId":    "<选中条目的 tenantId>",
  "tenantName":  "<选中条目的 tenantName>",
  "projectId":   "<选中条目的 projectId>",
  "projectName": "<选中条目的 projectName>"
}
```

成功返回：

```json
{
  "success": true,
  "activeProject": {
    "tenantId": "1234",
    "tenantName": "示例租户A",
    "projectId": "9001",
    "projectName": "示例项目甲",
    "updatedAt": "2026-05-13T..."
  },
  "message": "已切换到「示例租户A / 示例项目甲」"
}
```

状态写到 `~/.openclaw/state/wangxiaobao/active-project.json`，权限 0600。

---

## 输出模板

成功后回复用户（中文）：

```
✅ 已切换到「示例租户A / 示例项目甲」
租户 ID: 1234
项目 ID: 9001
状态保存在 ~/.openclaw/state/wangxiaobao/active-project.json

下一步可以：
- 查录音：让我帮你跑 wangxiaobao-audio-query / wangxiaobao-audio-wiki skill
- 快问 AI：让我帮你跑 wangxiaobao-quick-qa skill
```

---

## 仅查看不切换

用户只想"看看有哪些项目"而**不切换**时，调 `xiaobao_list_projects`（必要时带
`keyword` 收敛）渲染列表后停下来，不要调 `xiaobao_switch_project` tool。

---

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---|---|---|
| `xiaobao_list_projects` 返回 401 / token 过期 | 没登录或 refresh 失败 | 调 `xiaobao_authorize { force: true }` 重新走 device flow |
| `count == 0`（没带 keyword） | 账号无任何租户/项目权限 | 让用户找管理员加权限，本 skill 不继续 |
| `count == 0`（带了 keyword） | 关键字没匹配到任何项目 | 换更短关键字 / 不带 keyword 看全量，别直接说"没项目" |
| 用户输入的编号超出范围 | 选错了 | 重新提示当前可选编号区间 |
| 其他 tool 仍返回 `NO_ACTIVE_PROJECT` | 没调 switch-project tool 落地 | 检查 `~/.openclaw/state/wangxiaobao/active-project.json` 是否存在，重新走本 skill |
