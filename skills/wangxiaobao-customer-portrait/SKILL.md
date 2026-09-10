---
name: wangxiaobao-customer-portrait
version: 0.1.0
description: "旺小宝群体画像分布 + 客户字段字典：portrait list 取可用画像字段中文名；portrait get <字段> 取该字段饼图分布（count/items/rate）；config fields 客户字段配置字典（解读 dynamic_tags 标签含义）。只读。高频命令: xiaobao-cli portrait list; xiaobao-cli portrait get <中文字段名> [--from <t>] [--to <t>]; xiaobao-cli config fields。何时用：用户问 一批客户/一段时间的 意向业态/面积/区域/性别/年龄 分布或饼图、画像有哪些字段、dynamic_tags 里标签什么意思。注：单个客户的标签走 visit summary；按画像筛客户走 customer list --portrait；禁止用 customer list 的 dynamicTags 手算分布、禁止拿 config fields 当分布数据源。"
metadata:
  requires:
    bins: ["xiaobao-cli"]
  cliHelp: "xiaobao-cli portrait --help"
---

# 旺小宝群体画像分布 + 字段字典

> **CRITICAL** —— 跑命令前 MUST 先用 Read tool 读取 [`../wangxiaobao-shared/SKILL.md`](../wangxiaobao-shared/SKILL.md)。

## 路由优先级（必读）
1. **一批来访/一段时间/一群客户**的画像**分布/饼图**（业态、面积、区域、性别、年龄…）→ **本 skill**：先 `portrait list` 再 `portrait get`
2. **禁止**用 `customer list` 的 `dynamicTags` 本地聚合算分布；**禁止**拿 `config fields` 当分布数据源（它只是字段字典）
3. **单个客户**的标签/接待记录 → `visit summary`（dynamicTags 仅兜底）
4. 按画像**筛客户名单** → `customer list --portrait <关键词>`
5. 意向级别 KPI → `quantum intent`；`quantum` 不覆盖业态/面积/区域等画像饼图

## 命令
```bash
# 1) 字段清单（get 只能用这里返回的中文名，不要猜）
xiaobao-cli portrait list
# 2) 单字段分布（一次一个字段；多字段多次调用；to 建议日末 23:59:59）
xiaobao-cli portrait get 意向业态 --from "2026-09-01 00:00:00" --to "2026-09-10 23:59:59"
xiaobao-cli portrait get 性别 --from "..." --to "..." --user-ids 123,456
# 3) 字段字典（解读 dynamic_tags 的 key 含义/格式/备注）
xiaobao-cli config fields --size 100
```

## 响应字段
- `portrait list`：`fieldNames[]`（可用中文名）+ `fields[]{fieldName,fieldCode,values[{value,name}]}`（分档 code→中文枚举）。空列表=项目未配置画像展示字段→向用户说明，**不要**回退手算。
- `portrait get`：`fieldName`、`count`（样本总数）、`items[]{name,count,rate}`（name 已映射为中文分档）、可选 `other`
- `config fields`（`data.content[]`）：`fieldId`、`fieldName`（dynamic_tags 的 key 通常与此一致，不是 fieldCode）、`fieldFormat`（1 单值/2 多值/3 文本/4 百分比/5 时间/6 超链接/7 数字/8 多级单选/9 多级多选）、`remark`、`className`、`mappingFieldName`、`hasPanke`、`hasPortray`、`status`

## Agent 约束
- 先 `portrait list` 再 `get`，不要猜字段名、不要传 fieldCode
- 解读 dynamicTags 或做画像字段筛选前，先 `config fields` 确认合法字段名，不要猜语义
- 时间窗用 `xiaobao-cli date range` 系列取

## 常见错误
- `portrait get` 报字段不存在 → 字段名必须来自 `portrait list` 的 fieldNames
- 空分布 → 时间窗内无样本；`NO_ACTIVE_PROJECT`/401 → 见 shared
