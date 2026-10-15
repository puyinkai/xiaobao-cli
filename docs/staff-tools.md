# 员工工具（staff）使用说明

`staff` 走 MCP（`POST /mcp/wangai-cli`），按 agent-tool 的 10 个员工工具映射。
登录并激活项目后即可使用，无需其他配置。

| 命令 | 说明 |
| --- | --- |
| `staff list` | 列出 BFF 开放的员工工具目录（`json` 含各工具 inputSchema） |
| `staff call <tool>` | 调用某个员工工具；业务参数全部经 `--variables` 传递（见下方各工具示例） |

## 通用约定

- 员工对象不传时按当前登录人**自查**（`staff_user_id` 由登录身份解析）；
  指定他人查看时，授权范围由 BFF 按当前管理关系计算，越权目标会被拒绝
- 变量名支持下划线与驼峰两种写法（`staff_receptions_page_num` ≡ `staffReceptionsPageNum`）
- 业务变量字段以 `staff list` 返回的 inputSchema 为准
- 错误码：变量非法 → `INVALID_VARIABLES`；
  未知/不开放工具 → `STAFF_TOOL_NOT_FOUND`；
  越权目标 → `STAFF_TOOL_ERROR`，`details.code` 为 `EMPLOYEE_SCOPE_VIOLATION`；
  下游业务失败 → `STAFF_TOOL_ERROR`（均按通用退出码约定返回非 0）
- `--format json|toon` 对所有 `staff call` 生效，下方示例统一省略

## 各工具用法

**staff-receptions** — 员工接待事实

- 分页：`staff_receptions_page_num`、`staff_receptions_page_size`（≤10）
- 时间：`staff_receptions_start_time`、`staff_receptions_end_time`（`yyyy-MM-dd`）

```bash
xiaobao-cli staff call staff-receptions \
  --variables '{"staff_receptions_page_num":1,"staff_receptions_page_size":10,"staff_receptions_start_time":"2026-10-01","staff_receptions_end_time":"2026-10-14"}'
```

**staff-journey** — 员工旅程（事件流）

- 分页：`staff_journey_page_num`、`staff_journey_page_size`
- 筛选：`staff_journey_customer_name`、`staff_journey_customer_phone`、`staff_journey_event_types`、`staff_journey_intent_levels`
- 翻页续读：把上一页返回的 `next_cursor_time`、`next_cursor_event_uid` 分别作为
  `staff_journey_cursor_time`、`staff_journey_cursor_event_uid` 传回

```bash
xiaobao-cli staff call staff-journey \
  --variables '{"staff_journey_page_num":1,"staff_journey_page_size":10,"staff_journey_customer_name":"张三"}'

xiaobao-cli staff call staff-journey \
  --variables '{"staff_journey_page_num":2,"staff_journey_cursor_time":"2026-10-14 10:00:00","staff_journey_cursor_event_uid":"700173190197936128"}'
```

**staff-capability-profile** — 员工能力画像（快照 / 实时双模式）

- 快照模式（默认）：`staff_summary_task_id` 指定既有总结批次
- 实时模式：`staff_summary_data_mode: "live"` + `staff_summary_cutoff_time`
- 指标周期（实时模式）：`staff_metric_period` 取 `LAST_7_DAYS` / `LAST_30_DAYS` / `LAST_90_DAYS` / `ALL` / `CUSTOM`
  （`CUSTOM` 时另传 `staff_metric_start_time`、`staff_metric_end_time`）

```bash
xiaobao-cli staff call staff-capability-profile \
  --variables '{"staff_summary_task_id":123}'

xiaobao-cli staff call staff-capability-profile \
  --variables '{"staff_summary_data_mode":"live","staff_summary_cutoff_time":"2026-10-15 00:00:00","staff_metric_period":"LAST_7_DAYS"}'
```

**staff-recent-reception-summary** — 近期接待总结

- 与能力画像同双模式：`staff_summary_data_mode` + `staff_summary_cutoff_time`（快照模式用 `staff_summary_task_id`）

```bash
xiaobao-cli staff call staff-recent-reception-summary \
  --variables '{"staff_summary_data_mode":"live","staff_summary_cutoff_time":"2026-10-15 00:00:00"}'
```

**staff-recent-quality-inspection** — 近期质检结果

- 同双模式参数；可加 `staff_quality_visit_ids` 把结果收敛到指定接待单

```bash
xiaobao-cli staff call staff-recent-quality-inspection \
  --variables '{"staff_summary_data_mode":"live","staff_summary_cutoff_time":"2026-10-15 00:00:00","staff_quality_visit_ids":[700173190197936128]}'
```

**staff-deal-capability** — 员工成交能力

- 周期：`staff_deal_capability_period`（如 `30D`）；或改用起止日期 `staff_deal_capability_start_date`、`staff_deal_capability_end_date`

```bash
xiaobao-cli staff call staff-deal-capability \
  --variables '{"staff_deal_capability_period":"30D"}'

xiaobao-cli staff call staff-deal-capability \
  --variables '{"staff_deal_capability_start_date":"2026-10-01","staff_deal_capability_end_date":"2026-10-14"}'
```

**staff-employee-comments** — 员工评价（团队范围聚合）

- 花名册分页：`staff_team_page_num`、`staff_team_page_size`（默认 3 人/页，上限 3）

```bash
xiaobao-cli staff call staff-employee-comments \
  --variables '{"staff_team_page_num":1,"staff_team_page_size":3}'
```

**staff-voice-sessions** — 员工语音会话（团队范围聚合）

- 花名册分页同 `staff-employee-comments`

```bash
xiaobao-cli staff call staff-voice-sessions \
  --variables '{"staff_team_page_num":1,"staff_team_page_size":3}'
```

**staff-customer-profile** — 员工客户画像

- 可传 `staff_user_id` 指定员工；依赖员工旅程数据，首次调用会返回“先查员工旅程”的结构化指引

```bash
xiaobao-cli staff call staff-customer-profile \
  --variables '{"staff_user_id":123456}'
```

**staff-employee-comparison** — 员工对比

- 分页：`staff_comparison_page_num`、`staff_comparison_page_size`
- 至少两名已授权员工，需要较宽的授权范围与统一统计周期

```bash
xiaobao-cli staff call staff-employee-comparison \
  --variables '{"staff_comparison_page_num":1,"staff_comparison_page_size":10}'
```
