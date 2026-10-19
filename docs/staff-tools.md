# 员工工具（staff）使用说明

`staff` 走 MCP（`POST /mcp/wangai-cli`），包含员工查询工具及 BFF 的当前项目权限查询工具，实际目录以 `staff list` 为准。
登录并激活项目后即可使用，无需其他配置。

| 命令 | 说明 |
| --- | --- |
| `staff list` | 列出 BFF 开放的员工工具目录（`json` 含各工具 inputSchema） |
| `staff call <tool>` | 调用某个员工工具；业务参数全部经 `--variables` 传递（见下方各工具示例） |

## 通用约定

- 先调用 `staff-permission-scope` 查看当前项目的授权范围；从 `available_scopes` 按 `label` 选择
  `scope.employee_id`，原样作为字符串传给 `staff_user_id`；多个员工用 `staff_user_ids`
- 省略员工时使用当前授权范围（`active_scope`）；授权范围由 BFF 按当前管理关系计算，越权目标会被拒绝
- 统一统计时间使用 `--time-start` / `--time-end`（北京时间 `yyyy-MM-dd HH:mm:ss`），由 CLI 发送 `X-MCP-Time-Range`；不要用周期枚举代替精确起止时间
- 变量名支持下划线与驼峰两种写法（`staff_receptions_page_num` ≡ `staffReceptionsPageNum`）
- 业务变量字段以 `staff list` 返回的 inputSchema 为准
- 错误码：变量非法 → `INVALID_VARIABLES`；
  未知/不开放工具 → `STAFF_TOOL_NOT_FOUND`；
  越权目标 → `STAFF_TOOL_ERROR`，`details.code` 为 `EMPLOYEE_SCOPE_VIOLATION`；
  下游业务失败 → `STAFF_TOOL_ERROR`（均按通用退出码约定返回非 0）
- `--format json|toon` 对所有 `staff call` 生效，下方示例统一省略

## 各工具用法

**staff-permission-scope** — 当前项目管理权限范围

无需业务参数。返回 `viewer_roles`、`max_scope`、`active_scope`、`available_scopes`、
`authorized_employee_ids` 与 `selection_required`；员工及项目 ID 保持字符串。

```bash
xiaobao-cli staff call staff-permission-scope
```

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

**staff-capability-profile** — 员工能力画像（实时 / 快照）

- 未指定任务或模式时默认 `LIVE`，无需总结任务 ID
- 统一时间参数会补齐 `staff_metric_start_time`、`staff_metric_end_time` 和总结截止时间
- 查询已有任务快照时显式传 `staff_summary_task_id`，或同时指定 `staff_summary_data_mode: "SNAPSHOT"`

```bash
xiaobao-cli staff call staff-capability-profile \
  --time-start "2026-10-01 00:00:00" --time-end "2026-10-14 23:59:59" \
  --variables '{"staff_user_id":"<授权员工ID>"}'

xiaobao-cli staff call staff-capability-profile \
  --variables '{"staff_summary_task_id":"<已有任务ID>","staff_summary_data_mode":"SNAPSHOT"}'
```

**staff-recent-reception-summary** — 近期接待总结

- 同能力画像，默认实时查询；返回总结缺失不代表没有接待
- 返回 `PARTIAL_SOURCE` 或 `metadata.data_status=partial` 时，应保留实际覆盖周期和缺失说明

```bash
xiaobao-cli staff call staff-recent-reception-summary \
  --time-start "2026-10-01 00:00:00" --time-end "2026-10-14 23:59:59" \
  --variables '{"staff_user_id":"<授权员工ID>"}'
```

**staff-recent-quality-inspection** — 近期质检结果

- 默认实时查询，无需总结任务 ID；先从 `staff-journey` 返回的记录取得真实 `visit_id`
- 将 `visit_id` 原样作为字符串传入 `staff_quality_visit_ids`，并传对应的 `staff_user_id`；不能用事件 ID 代替

```bash
xiaobao-cli staff call staff-recent-quality-inspection \
  --time-start "2026-10-01 00:00:00" --time-end "2026-10-14 23:59:59" \
  --variables '{"staff_user_id":"<授权员工ID>","staff_quality_visit_ids":["<旅程返回的visit_id>"]}'
```

**staff-deal-capability** — 员工成交能力

- 必须选定授权员工，使用精确起止时间；不要传周期枚举
- 统一时间参数会补齐 `staff_deal_capability_start_date`、`staff_deal_capability_end_date`

```bash
xiaobao-cli staff call staff-deal-capability \
  --time-start "2026-10-01 00:00:00" --time-end "2026-10-14 23:59:59" \
  --variables '{"staff_user_id":"<授权员工ID>"}'
```

**staff-employee-comments** — 员工评价（团队范围聚合）

- 花名册分页：`staff_team_page_num`、`staff_team_page_size`（每页最多 10 人）

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
  --time-start "2026-10-01 00:00:00" --time-end "2026-10-14 23:59:59" \
  --variables '{"staff_user_ids":["<授权员工ID1>","<授权员工ID2>"]}'
```
