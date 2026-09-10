---
name: wangxiaobao-beautx
version: 0.1.0
description: "旺小宝医美（beautx）业务查询：变美计划（beautx plan，报告分组/面诊医生/复诊时间）、成交分析（beautx deal-analysis，成交状态/未成交点/原因）、来访画像标签（beautx portrait-tags，维度→命中标签）、接诊评价（beautx visit-evaluate，总分+5 项能力分与建议）。只读、共用筛选（--visit-ids/--customer-ids/--beautx-customer-ids/--from/--to/分页）。高频命令: xiaobao-cli beautx plan|deal-analysis|portrait-tags|visit-evaluate [--customer-ids <csv>] [--from <t>] [--to <t>]。何时用：医美项目用户问 某客户变美计划、为什么没成交/未成交点分布、接诊评价得分、来访画像标签。注：仅医美业态项目有数据，地产项目返回空列表是正常；地产的来访/客户/画像走 visit/customer/portrait 命令。"
metadata:
  requires:
    bins: ["xiaobao-cli"]
  cliHelp: "xiaobao-cli beautx --help"
---

# 旺小宝医美（beautx）查询

> **CRITICAL** —— 跑命令前 MUST 先用 Read tool 读取 [`../wangxiaobao-shared/SKILL.md`](../wangxiaobao-shared/SKILL.md)。

## 四个能力
| 命令 | 语义 | 特有参数 |
| --- | --- | --- |
| `beautx plan` | 变美计划报告（sections 分组 → items{reportTag,answer,evidence}，面诊医生/复诊时间/消费内容） | `--latest-only` 每客户最新一条 |
| `beautx deal-analysis` | 成交分析（dealStatus、未成交分类/未成交点、reason/analysisResult） | `--latest-only` |
| `beautx portrait-tags` | 来访画像标签（dimensionTags[] 维度 → speechTags[] 命中标签值） | `--dimension` 维度名过滤 |
| `beautx visit-evaluate` | 接诊评价（totalScore/totalEvaluation + abilities[] 5 项能力分/评价/建议） | — |

共用筛选：`--visit-ids` / `--customer-ids`（wang_id）/ `--beautx-customer-ids`（医美业务客户 ID）/ `--from` `--to` / `--page` `--size`。

## 命令示例
```bash
xiaobao-cli beautx plan --customer-ids <wang_id> --latest-only
xiaobao-cli beautx deal-analysis --from "2026-09-01 00:00:00" --to "2026-09-10 23:59:59"
xiaobao-cli beautx portrait-tags --visit-ids <visit_id> --dimension 肤质
xiaobao-cli beautx visit-evaluate --customer-ids <wang_id>
```

## 响应共性
分页 `data.{page,size,total,content[]}`；每行都带 `visitId`、`customerId`(wang_id)、`customer`（简要：姓名/手机/意向）、`beautxCustomerId`、`userId/userName/userInfo`（**接待顾问**）、`visitTime`、`dealStatus`。按各命令再挂 sections/abilities/dimensionTags 等。

## Agent 约束
- **仅医美业态**有数据：地产项目查询返回空列表是正常，不要报"接口挂了"；用户在地产项目问来访/客户/画像 → 走 visit/customer/portrait 命令
- 按客户姓名查：先 `customer list --customer-name` 反查 wang_id
- 时间窗用 `xiaobao-cli date range` 取

## 常见错误
- 空列表 → 非医美项目或范围内无数据；`NO_ACTIVE_PROJECT`/401 → 见 shared
