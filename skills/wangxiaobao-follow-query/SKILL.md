---
name: wangxiaobao-follow-query
version: 0.1.0
description: "旺小宝旺跟进查询：跟进明细分页（follow list，谁/何时/以什么方式跟进了哪个客户，含通话时长/消息条数）+ 电话/微信指标汇总（follow summary，呼入呼出接通率/通话时长/微信消息数）。只读。高频命令: xiaobao-cli follow list [--user-ids <csv>] [--customer-ids <csv>] [--from <t>] [--to <t>]; xiaobao-cli follow summary [同筛选]。何时用：用户问 今天/本周跟进了哪些客户、某顾问跟进明细、某客户跟进历史、电话呼出接通率、微信跟进消息数。注：聚合统计卡片（跟进量 rank/team/time KPI）走 quantum follow，不是这里；明细行不含客户姓名，收集 wangId 后用 customer list --customer-ids 补。"
metadata:
  requires:
    bins: ["xiaobao-cli"]
  cliHelp: "xiaobao-cli follow --help"
---

# 旺小宝旺跟进（明细 + 电话/微信汇总）

> **CRITICAL** —— 跑命令前 MUST 先用 Read tool 读取 [`../wangxiaobao-shared/SKILL.md`](../wangxiaobao-shared/SKILL.md)（登录 / 激活项目 / 错误码 / 输出协议）。

## 分工（先选对工具）
| 用户问法 | 用什么 |
| --- | --- |
| 跟进明细名单（谁/何时/方式/内容量） | `follow list`（本 skill） |
| 电话接通率 / 呼出时长 / 微信消息数 | `follow summary`（本 skill） |
| 跟进量排名 / 团队对比 / 时间趋势 KPI | `quantum follow`（wangxiaobao-quantum-stats） |

## 命令
```bash
# 今天的跟进明细（时间窗先用 date range today 拿，不要凭记忆填日期）
xiaobao-cli follow list --from "2026-09-10 00:00:00" --to "2026-09-11 00:00:00"
# 某顾问 / 某客户
xiaobao-cli follow list --user-ids 123,456 --page 1 --size 10
xiaobao-cli follow list --customer-ids 639431065898848256
# 汇总指标（同筛选，不分页）
xiaobao-cli follow summary --from "2026-09-08 00:00:00" --to "2026-09-11 00:00:00"
```
参数：`--user-ids` 跟进人 userId CSV（只在当前用户可见范围内生效）；`--customer-ids` 客户 wang_id CSV；`--from/--to` 可只传一侧，格式 `yyyy-MM-dd HH:mm:ss`。

## 响应字段
- `follow list`（`data.content[]`）：`followId`、`wangId`（**无姓名**→用 `customer list --customer-ids` 补）、`salesId`、`followType/Label`（0 主动/1 被动）、`followMethod/Label`（0 电话/1 短信/2 微信/3 微信通话/4 企微/5 企微通话）、`actionTime`、`customerPhone`、`followerName/Phone`（可空）、`callDurationSec`、`smsCount`、`wechatMsgCount`
- `follow summary`：`phoneInboundCount/ConnectedCount/ConnectRate`、`phoneOutboundCount/ConnectedCount/ConnectRate`、`phoneOutboundDurationMinutes/AvgDurationMinutes`、`wechatCallCount`、`wechatMessageCount`（接通率分母 0 时为 null）

## Agent 约束
- 用户未明确问跟进/电话/微信触达时，**不要**主动调本命令
- 跟进量 KPI 禁止用 `follow list` 翻页数 total——用 `follow summary` 或 `quantum follow`
- 按客户姓名查：先 `customer list --customer-name` 反查 wang_id 再 `--customer-ids`
- 时间窗用 `xiaobao-cli date range today|this-week` 等取，禁止凭记忆算日期

## 常见错误
- `NO_ACTIVE_PROJECT` → 先切项目；401 → 重登；空列表 → 时间窗/范围内确实无跟进（不是 bug）
