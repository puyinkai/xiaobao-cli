---
name: wangxiaobao-staff-tools
version: 0.1.0
description: "旺小宝员工工具（staff-*，以实时目录为准）统一入口：`xiaobao-cli staff list` 看目录、`xiaobao-cli staff call <tool> --variables '{...}'` 调用。CLI 根据当前项目与 token 组装 MCP 身份头，网关与 BFF 校验身份及授权范围；不得在业务变量中伪造身份或权限；业务字段全部放进 `--variables` 这一个 JSON object。各工具的完整变量与可复制示例都写在本文件里（参数说明不依赖外部文档）。覆盖能力：员工接待记录 / 员工旅程事件流 / 员工能力画像 / 近期接待总结 / 近期质检 / 成交能力 / 员工评价 / 盘销语音会话 / 员工名下的客户画像 / 员工对比。何时用：用户问某员工的接待或接访记录、员工旅程、员工能力与成交、员工近期表现或质检、员工评价、盘销（语音会话）记录、两名以上员工对比，以及「我的…」类自指查询（不传员工 id 时使用当前授权范围）。注：客户画像 MUST 先调 staff-journey 拿 customer_id；团队范围 MUST 先经 staff-permission-scope 查询授权员工；要客户名单/来访列表/录音元数据请用 `xiaobao-cli customer list` / `visit list` / `audio list`，不要用员工工具。"
metadata:
  requires:
    bins: ["xiaobao-cli"]
  cliHelp: "xiaobao-cli staff --help"
---

# 员工工具（staff-*）

> **CRITICAL** —— 跑命令前 MUST 先用 Read tool 读取 [`../wangxiaobao-shared/SKILL.md`](../wangxiaobao-shared/SKILL.md)（一份共享文档讲清安装 / 登录 / 选项目 / 全局 flags / 输出协议 / 通用错误码等所有 xiaobao-cli 命令通用的前置约定）。本文件的「执行前必读」只列员工工具**特有**的约束；各工具的**参数说明全部写在本文件内**，不需要另查文档。

员工工具只有两个命令：

```bash
xiaobao-cli staff list                                    # 看当前开放的员工工具目录
xiaobao-cli staff call <tool> --variables '{"键":"值"}'    # 调用某个员工工具
```

先调用 `staff-permission-scope` 查看授权员工与当前 `active_scope`。不传员工 id 时使用当前授权范围。

---

## 执行前必读

安装 / 登录（`auth login --no-wait` → 用户点链接 → `auth login --resume`）/ 激活项目 / 全局 flags / 输出协议等**通用约定见共享 skill**（本文件开头已要求先读）。以下是员工工具**特有**的约束：

- **必须有有效 token**：先 `xiaobao-cli auth whoami`；未登录按共享 skill 的 split-flow 登录
- **必须有激活项目**：缺失返回 `NO_ACTIVE_PROJECT`
- **身份与授权范围不由调用方填**：CLI 根据当前项目与 token 组装 MCP 租户/项目/用户头；网关验证 token 身份，BFF 再按当前管理关系**算出你能看哪些员工**。往 `--variables` 里塞 `tenant_id` / `viewer_id` / `active_scope` / `max_scope` 等会被服务端**静默剥离**——不报错，也不生效
- **越权会被拦**：`staff_user_id` 不在授权范围内时返回 `isError=true`、`error=STAFF_TOOL_ERROR`、`details.code=EMPLOYEE_SCOPE_VIOLATION`。**不要用同一个 id 重试**，先回去做员工解析
- 变量名支持下划线或驼峰（`staff_receptions_page_num` ≡ `staffReceptionsPageNum`）；分页变量有通用兜底（缺具体前缀时 `page_num` / `page_size` 也生效），但**优先用下面各工具的具名变量**
- **只读**：不写文件、不出报告

---

## 依赖顺序（有先后）

| 依赖 | 规则 | 缺前置的表现 |
| --- | --- | --- |
| **`staff-customer-profile` ← `staff-journey`** | 画像需要 `customer_id`，只能从 `staff-journey` 返回的 `journey_customer_options` 里挑一个（一次只查一个客户） | `dependency_missing` + `next_tool: "staff-journey"` → 回 journey 重新选，**不要猜 id** |
| **`staff-deal-capability`（团队/多人）← `staff-permission-scope`** | 先用 `staff-permission-scope` 获取授权员工，按名称选择具体 `scope.employee_id`（最多 10 人） | `todo`：「请先通过员工解析选择具体员工…团队范围请使用员工能力画像」 |
| `staff-recent-quality-inspection` ← `staff-journey` | 没有真实来访 ID 时，先取旅程记录的 `visit_id`，不可用事件 ID 代替 | 缺少来访范围时按返回指引补齐 |

---

## 各工具参数

### `staff-permission-scope` — 当前项目管理权限范围

```bash
xiaobao-cli staff call staff-permission-scope
```

无需业务参数。返回 `viewer_roles`、`max_scope`、`active_scope`、`available_scopes`、
`authorized_employee_ids`、`selection_required`。从 `available_scopes` 按 `label` 选择
`scope.employee_id`，作为 `staff_user_id`；多个员工用 `staff_user_ids`。所有 ID 原样保留为字符串。

统计时间通过 `--time-start` / `--time-end` 指定（北京时间 `yyyy-MM-dd HH:mm:ss`），
CLI 自动发送 `X-MCP-Time-Range`。不要用周期枚举代替精确起止时间。

### 1. `staff-receptions` — 员工接待记录（明细）

真实接访事实，来源 ai-voice 接访表。

| 变量 | 说明 |
| --- | --- |
| `staff_user_id` | 员工 id；省略时使用当前授权范围 |
| `staff_receptions_page_num` | 页码，默认 1 |
| `staff_receptions_page_size` | 每页条数，默认 10，**上限 10** |
| `staff_receptions_start_time` / `staff_receptions_end_time` | 时间窗，`yyyy-MM-dd` |

```bash
xiaobao-cli staff call staff-receptions \
  --variables '{"staff_receptions_page_num":1,"staff_receptions_page_size":10,"staff_receptions_start_time":"2026-10-01","staff_receptions_end_time":"2026-10-14"}'
```

---

### 2. `staff-journey` — 员工旅程（事件流）

来访/跟进等事件的时间线；**也是客户画像的前置**——它返回的 `journey_customer_options` 是 `customer_id` 的唯一来源。

| 变量 | 说明 |
| --- | --- |
| `staff_user_id` | 员工 id；省略时使用当前授权范围 |
| `staff_journey_page_num` / `staff_journey_page_size` | 页参数 |
| `staff_journey_start_time` / `staff_journey_end_time` | 时间窗 |
| `staff_journey_customer_name` / `staff_journey_customer_phone` | 按客户筛选（手机号只用于筛，不回显） |
| `staff_journey_event_types` | 事件类型 |
| `staff_journey_event_subtype_codes` | 事件子类型 |
| `staff_journey_intent_levels` | 意向等级 |
| `staff_journey_visit_stage_ids` | 来访阶段 |
| `staff_journey_cursor_time` / `staff_journey_cursor_event_uid` | **翻页续读**：把上一页返回的 `next_cursor_time` / `next_cursor_event_uid` 原样传回 |

```bash
# 第一页
xiaobao-cli staff call staff-journey \
  --variables '{"staff_journey_page_num":1,"staff_journey_page_size":10,"staff_journey_customer_name":"张三"}'

# 续读下一页（游标来自上一页返回值）
xiaobao-cli staff call staff-journey \
  --variables '{"staff_journey_page_num":2,"staff_journey_cursor_time":"2026-10-14 10:00:00","staff_journey_cursor_event_uid":"700173190197936128"}'
```

---

### 3. `staff-capability-profile` — 员工能力画像（实时 / 快照）

| 变量 | 说明 |
| --- | --- |
| `staff_user_id` | 授权员工 ID 字符串；省略时使用当前授权范围 |
| `staff_summary_task_id` | 可选，查询已有任务快照时指定 |
| `staff_summary_data_mode` | `LIVE` 或 `SNAPSHOT`；未指定任务或模式时默认 `LIVE` |
| `staff_summary_cutoff_time` | 可选，默认统一时间范围的 end，其次指标结束时间，均未提供时使用当前时间 |
| `staff_metric_start_time` / `staff_metric_end_time` | 精确统计起止时间；默认由 CLI 统一时间参数补齐 |
| `staff_team_page_num` / `staff_team_page_size` | 团队分页，每页最多 10 人 |

```bash
xiaobao-cli staff call staff-capability-profile \
  --time-start "2026-10-01 00:00:00" --time-end "2026-10-14 23:59:59" \
  --variables '{"staff_user_id":"<授权员工ID>"}'

# 仅在需要已有任务快照时使用
xiaobao-cli staff call staff-capability-profile \
  --variables '{"staff_summary_task_id":"<已有任务ID>","staff_summary_data_mode":"SNAPSHOT"}'
```

---

### 4. `staff-recent-reception-summary` — 员工近期接待总结

同能力画像参数，默认实时查询。无总结不等于无接待；`PARTIAL_SOURCE` 或
`metadata.data_status=partial` 时保留实际覆盖周期和缺失说明，不把部分数据描述为完整数据。

```bash
xiaobao-cli staff call staff-recent-reception-summary \
  --time-start "2026-10-01 00:00:00" --time-end "2026-10-14 23:59:59" \
  --variables '{"staff_user_id":"<授权员工ID>"}'
```

---

### 5. `staff-recent-quality-inspection` — 员工近期质检结果

默认实时查询，无需总结任务 ID。先从 `staff-journey` 返回记录取得真实 `visit_id`，
原样作为字符串数组传给 `staff_quality_visit_ids`，并传对应的 `staff_user_id`。
不能使用事件 ID 代替来访 ID；部分质检不可用时保留返回的状态与可用证据。

```bash
xiaobao-cli staff call staff-recent-quality-inspection \
  --time-start "2026-10-01 00:00:00" --time-end "2026-10-14 23:59:59" \
  --variables '{"staff_user_id":"<授权员工ID>","staff_quality_visit_ids":["<旅程返回的visit_id>"]}'
```

---

### 6. `staff-deal-capability` — 员工成交能力

先从权限工具选择授权员工，`staff_user_id` 指定一人，`staff_user_ids` 指定多人（最多 10 人）。
使用精确起止时间；统一时间参数会补齐 `staff_deal_capability_start_date` / `staff_deal_capability_end_date`。
不要使用周期枚举。`NO_DATA` / `UNAVAILABLE` 不代表数值为 0。

```bash
xiaobao-cli staff call staff-deal-capability \
  --time-start "2026-10-01 00:00:00" --time-end "2026-10-14 23:59:59" \
  --variables '{"staff_user_id":"<授权员工ID>"}'
```

---

### 7. `staff-employee-comments` — 员工评价 / 评论

| 变量 | 说明 |
| --- | --- |
| `staff_user_id` | 员工 id；省略时使用当前授权范围 |
| `staff_comments_page_num` / `staff_comments_page_size` | 页参数 |
| `staff_comments_root_comment_id` | 查某条评论的回复（默认不查回复） |
| `staff_comments_cursor_time` / `staff_comments_cursor_id` | 翻页续读游标 |

```bash
xiaobao-cli staff call staff-employee-comments --variables '{"staff_user_id":"483545700378873856","staff_comments_page_size":10}'
```

---

### 8. `staff-voice-sessions` — 员工盘销记录（语音会话）

| 变量 | 说明 |
| --- | --- |
| `staff_user_id` | 员工 id；省略时使用当前授权范围 |
| `staff_voice_sessions_page_num` / `staff_voice_sessions_page_size` | 页参数 |
| `staff_voice_sessions_start_time` / `staff_voice_sessions_end_time` | 时间窗 |

```bash
xiaobao-cli staff call staff-voice-sessions --variables '{"staff_user_id":"483545700378873856","staff_voice_sessions_page_size":10}'
```

---

### 9. `staff-customer-profile` — 员工接待中的客户画像

**必须先调 `staff-journey`**，从它返回的 `journey_customer_options` 里选一个 `customer_id`。

| 变量 | 说明 |
| --- | --- |
| `customer_id` | **必填**，一次只查一个客户 |
| `staff_user_id` | 该客户对应的员工（可选，用于收窄） |

```bash
# 1) 先拿客户候选
xiaobao-cli staff call staff-journey --variables '{"staff_user_id":"483545700378873856"}'
# 2) 从 journey 返回的 journey_customer_options 里挑一个 customer_id 再查画像
xiaobao-cli staff call staff-customer-profile --variables '{"customer_id":"700525516968431616","staff_user_id":"483545700378873856"}'
```

---

### 10. `staff-employee-comparison` — 员工能力对比

| 变量 | 说明 |
| --- | --- |
| `staff_user_ids` | 要比对的员工，至少 2 名，都必须在授权范围内 |
| `staff_comparison_page_num` / `staff_comparison_page_size` | 页参数（每页最多 10 人） |
| `--time-start` / `--time-end` | 统一统计起止时间（多员工比对需要同一周期） |

```bash
xiaobao-cli staff call staff-employee-comparison \
  --time-start "2026-10-01 00:00:00" --time-end "2026-10-14 23:59:59" \
  --variables '{"staff_user_ids":["<授权员工ID1>","<授权员工ID2>"]}'
```

---

## 结果与错误

**结果类型看 `metadata.result_type`**——**`no_hit` / `todo` 不等于取数成功**，不要当成业务结论：

| 值 | 含义 | 怎么做 |
| --- | --- | --- |
| `data` | 拿到数据 | 用 `metadata.data_status` 判断新鲜度（`READY` / `partial` / `missing` / `unavailable`） |
| `no_hit` | 查了但没有 | 如实说明"没有数据"，别编 |
| `todo` | 缺参数或需要先选人 | 按返回的 `message` 补参数 |
| `dependency_missing` | 缺前置，带 `next_tool` | 先调 `next_tool` 指的那个工具 |

**服务端结构化错误**（`isError=true`，`error=STAFF_TOOL_ERROR`，真实码在 **`details.code`**）：

| `details.code` | 含义 | 处理 |
| --- | --- | --- |
| `EMPLOYEE_SCOPE_VIOLATION` | 目标员工不在授权范围 | **别重试同一个 id**，回去做员工解析 |
| `AGENT_TOOL_NOT_ALLOWED` | 工具未对当前入口开放 | 先 `staff list` 确认目录 |
| `AGENT_TOOL_NOT_FOUND` | 下游未注册该工具 | 换工具或反馈 |
| `AGENT_TOOL_TIMEOUT` / `AGENT_TOOL_UNAVAILABLE` | 下游超时 / 不可用 | 可稍后重试 |
| `EMPLOYEE_CONTEXT_MISSING` | 缺少可信身份上下文 | 环境问题，反馈 |
| `AGENT_TOOL_BAD_RESPONSE` | 下游返回非预期结构 | 反馈 |
