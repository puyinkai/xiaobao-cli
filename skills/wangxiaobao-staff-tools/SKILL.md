---
name: wangxiaobao-staff-tools
version: 0.1.0
description: "旺小宝员工工具（staff-*，共 10 个）统一入口：`xiaobao-cli staff list` 看目录、`xiaobao-cli staff call <tool> --variables '{...}'` 调用。员工身份（租户/项目/用户）与员工授权范围由网关与 BFF 注入，**CLI 不填也不该填**；业务字段全部放进 `--variables` 这一个 JSON object。十个工具的完整变量与可复制示例都写在本文件里（参数说明不依赖外部文档）。覆盖能力：员工接待记录 / 员工旅程事件流 / 员工能力画像 / 近期接待总结 / 近期质检 / 成交能力 / 员工评价 / 盘销语音会话 / 员工名下的客户画像 / 员工对比。何时用：用户问某员工的接待或接访记录、员工旅程、员工能力与成交、员工近期表现或质检、员工评价、盘销（语音会话）记录、两名以上员工对比，以及「我的…」类自指查询（不传员工 id 时按当前登录人自查）。注：客户画像 MUST 先调 staff-journey 拿 customer_id；团队范围 MUST 先经 staff-capability-profile 做员工解析选人；要客户名单/来访列表/录音元数据请用 `xiaobao-cli customer list` / `visit list` / `audio list`，不要用员工工具。"
metadata:
  requires:
    bins: ["xiaobao-cli"]
  cliHelp: "xiaobao-cli staff --help"
---

# 员工工具（staff-*）

> **CRITICAL** —— 跑命令前 MUST 先用 Read tool 读取 [`../wangxiaobao-shared/SKILL.md`](../wangxiaobao-shared/SKILL.md)（一份共享文档讲清安装 / 登录 / 选项目 / 全局 flags / 输出协议 / 通用错误码等所有 xiaobao-cli 命令通用的前置约定）。本文件的「执行前必读」只列员工工具**特有**的约束；十个工具的**参数说明全部写在本文件内**，不需要另查文档。

员工工具只有两个命令：

```bash
xiaobao-cli staff list                                    # 看当前开放的员工工具目录
xiaobao-cli staff call <tool> --variables '{"键":"值"}'    # 调用某个员工工具
```

不传员工 id 时按**当前登录人**自查（"我的接待记录"直接调即可）。

---

## 执行前必读

安装 / 登录（`auth login --no-wait` → 用户点链接 → `auth login --resume`）/ 激活项目 / 全局 flags / 输出协议等**通用约定见共享 skill**（本文件开头已要求先读）。以下是员工工具**特有**的约束：

- **必须有有效 token**：先 `xiaobao-cli auth whoami`；未登录按共享 skill 的 split-flow 登录
- **必须有激活项目**：缺失返回 `NO_ACTIVE_PROJECT`
- **身份与授权范围不由调用方填**：CLI 只发租户/项目头；网关验 token 后注入用户身份，BFF 再按当前管理关系**算出你能看哪些员工**。往 `--variables` 里塞 `tenant_id` / `viewer_id` / `active_scope` / `max_scope` 等会被服务端**静默剥离**——不报错，也不生效
- **越权会被拦**：`staff_user_id` 不在授权范围内时返回 `isError=true`、`error=STAFF_TOOL_ERROR`、`details.code=EMPLOYEE_SCOPE_VIOLATION`。**不要用同一个 id 重试**，先回去做员工解析
- 变量名支持下划线或驼峰（`staff_receptions_page_num` ≡ `staffReceptionsPageNum`）；分页变量有通用兜底（缺具体前缀时 `page_num` / `page_size` 也生效），但**优先用下面各工具的具名变量**
- **只读**：不写文件、不出报告

---

## 依赖顺序（有先后）

| 依赖 | 规则 | 缺前置的表现 |
| --- | --- | --- |
| **`staff-customer-profile` ← `staff-journey`** | 画像需要 `customer_id`，只能从 `staff-journey` 返回的 `journey_customer_options` 里挑一个（一次只查一个客户） | `dependency_missing` + `next_tool: "staff-journey"` → 回 journey 重新选，**不要猜 id** |
| **`staff-deal-capability`（团队/多人）← `staff-capability-profile`** | 团队范围不能自行选人：先用能力画像做「员工解析」拿具体 `staff_user_id`（或已授权的 2~3 个 id） | `todo`：「请先通过员工解析选择具体员工…团队范围请使用员工能力画像」 |
| 其余 8 个 | 彼此独立，任意顺序 | — |

---

## 十个工具（逐个写全）

### 1. `staff-receptions` — 员工接待记录（明细）

真实接访事实，来源 ai-voice 接访表。

| 变量 | 说明 |
| --- | --- |
| `staff_user_id` | 员工 id；**不传 = 当前登录人** |
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
| `staff_user_id` | 员工 id；不传 = 当前登录人 |
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

### 3. `staff-capability-profile` — 员工能力画像（快照 / 实时双模式）

| 变量 | 说明 |
| --- | --- |
| `staff_user_id` | 员工 id；不传 = 当前登录人 |
| `staff_summary_task_id` | **快照模式**（默认）：指定既有总结批次 |
| `staff_summary_data_mode` | 传 `"live"` 切到**实时模式** |
| `staff_summary_cutoff_time` | 实时模式必填：统计截止时间，`yyyy-MM-dd HH:mm:ss` |
| `staff_metric_period` | 实时模式的指标周期：`LAST_7_DAYS` / `LAST_30_DAYS` / `LAST_90_DAYS` / `ALL` / `CUSTOM` |
| `staff_metric_start_time` / `staff_metric_end_time` | `CUSTOM` 时必填 |
| `staff_team_page_num` / `staff_team_page_size` | 团队范围时按页解析员工，**每页最多 3 名** |

```bash
# 快照模式
xiaobao-cli staff call staff-capability-profile --variables '{"staff_summary_task_id":123}'

# 实时模式
xiaobao-cli staff call staff-capability-profile \
  --variables '{"staff_summary_data_mode":"live","staff_summary_cutoff_time":"2026-10-16 00:00:00","staff_metric_period":"LAST_7_DAYS","staff_user_id":483545700378873856}'
```

---

### 4. `staff-recent-reception-summary` — 员工近期接待总结

与能力画像**同双模式参数**（`staff_summary_data_mode` + `staff_summary_cutoff_time`；快照模式用 `staff_summary_task_id`），另支持团队分页变量。只返回总结性信息，不含接待明细。

```bash
xiaobao-cli staff call staff-recent-reception-summary \
  --variables '{"staff_summary_data_mode":"live","staff_summary_cutoff_time":"2026-10-16 00:00:00","staff_user_id":483545700378873856}'
```

---

### 5. `staff-recent-quality-inspection` — 员工近期质检结果

同双模式参数；可指定接待单。

| 变量 | 说明 |
| --- | --- |
| `staff_quality_visit_ids` | 接待单 id 列表（**须真实 visitId**，通常来自 `staff-receptions` 的结果） |
| `staff_quality_visit_id` | 单个接待单 id |

```bash
xiaobao-cli staff call staff-recent-quality-inspection \
  --variables '{"staff_summary_data_mode":"live","staff_summary_cutoff_time":"2026-10-16 00:00:00","staff_quality_visit_ids":[700173190197936128]}'
```

---

### 6. `staff-deal-capability` — 员工成交能力

| 变量 | 说明 |
| --- | --- |
| `staff_user_id` | 单个员工（不传 = 当前登录人） |
| `staff_user_ids` | 多个员工，**最多 3 名**；必须都在授权范围内 |
| `staff_deal_capability_period` | 周期，如 `30D`（也接受 `LAST_7_DAYS` / `LAST_30_DAYS` / `LAST_90_DAYS` / `ALL` / `CUSTOM`） |
| `staff_deal_capability_start_date` / `staff_deal_capability_end_date` | 改用起止日期（`yyyy-MM-dd`） |
| `staff_metric_period` / `staff_metric_start_time` / `staff_metric_end_time` | 指标周期（同上，`CUSTOM` 时给起止） |
| `staff_user_names` | 可选，展示用名字 |

> **团队范围**：不能自行选人，先用 `staff-capability-profile` 做员工解析拿 id。

```bash
xiaobao-cli staff call staff-deal-capability --variables '{"staff_deal_capability_period":"30D","staff_user_id":483545700378873856}'
xiaobao-cli staff call staff-deal-capability --variables '{"staff_deal_capability_start_date":"2026-10-01","staff_deal_capability_end_date":"2026-10-14"}'
```

---

### 7. `staff-employee-comments` — 员工评价 / 评论

| 变量 | 说明 |
| --- | --- |
| `staff_user_id` | 员工 id；不传 = 当前登录人 |
| `staff_comments_page_num` / `staff_comments_page_size` | 页参数 |
| `staff_comments_root_comment_id` | 查某条评论的回复（默认不查回复） |
| `staff_comments_cursor_time` / `staff_comments_cursor_id` | 翻页续读游标 |

```bash
xiaobao-cli staff call staff-employee-comments --variables '{"staff_user_id":483545700378873856,"staff_comments_page_size":10}'
```

---

### 8. `staff-voice-sessions` — 员工盘销记录（语音会话）

| 变量 | 说明 |
| --- | --- |
| `staff_user_id` | 员工 id；不传 = 当前登录人 |
| `staff_voice_sessions_page_num` / `staff_voice_sessions_page_size` | 页参数 |
| `staff_voice_sessions_start_time` / `staff_voice_sessions_end_time` | 时间窗 |

```bash
xiaobao-cli staff call staff-voice-sessions --variables '{"staff_user_id":483545700378873856,"staff_voice_sessions_page_size":10}'
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
xiaobao-cli staff call staff-journey --variables '{"staff_user_id":483545700378873856}'
# 2) 从 journey 返回的 journey_customer_options 里挑一个 customer_id 再查画像
xiaobao-cli staff call staff-customer-profile --variables '{"customer_id":700525516968431616,"staff_user_id":483545700378873856}'
```

---

### 10. `staff-employee-comparison` — 员工能力对比

| 变量 | 说明 |
| --- | --- |
| `staff_user_ids` | 要比对的员工，**2~3 名**，都必须在授权范围内 |
| `staff_comparison_page_num` / `staff_comparison_page_size` | 页参数（每页最多 3 人） |
| `staff_summary_cutoff_time` | 统一的统计截止时间（多员工比对需要同一周期） |

```bash
xiaobao-cli staff call staff-employee-comparison --variables '{"staff_user_ids":[483545700378873856,483545700378873857],"staff_summary_cutoff_time":"2026-10-16 00:00:00"}'
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
